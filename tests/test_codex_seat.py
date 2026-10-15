"""Wrapper contract tests; no model calls, credentials or real browser operations."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

WRAPPER = Path(__file__).resolve().parents[1] / 'plugins/gpt-seat/scripts/codex-seat'
STUB = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
if args[:3] == ['mcp', 'get', 'cua_repl']:
    state = os.environ.get('TEST_CUA_STATE', 'enabled')
    if state == 'missing':
        print('SENSITIVE_DIAGNOSTIC', file=sys.stderr)
        sys.exit(1)
    print(json.dumps({'enabled': state != 'disabled',
      'enabled_tools': ['js'] if state != 'filtered' else [],
      'disabled_tools': ['js'] if state == 'denied' else []}))
    sys.exit(0)
assert args[0] == 'exec', args
Path(os.environ['TEST_CAPTURE']).write_text(json.dumps({'args': args, 'prompt': sys.stdin.read()}))
if os.environ.get('TEST_EXEC_FAIL'):
    print('SENSITIVE_DIAGNOSTIC', file=sys.stderr)
    sys.exit(1)
Path(args[args.index('-o')+1]).write_text('verified result')
'''


@unittest.skipUnless(shutil.which('node') and shutil.which('git'), 'requires Node.js and git')
class WrapperTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='codex-seat-test-')
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        binary = self.dir / 'codex'
        binary.write_text(STUB)
        binary.chmod(0o755)
        self.capture = self.dir / 'capture.json'
        self.env = dict(os.environ, PATH=str(self.dir) + os.pathsep + os.environ['PATH'],
                        TEST_CAPTURE=str(self.capture))
        subprocess.run(['git', 'init', '-q', str(self.dir)], check=True)

    def run_seat(self, flags=(), **env):
        return subprocess.run(['sh', str(WRAPPER), *flags, 'gpt-6-astra', 'high', str(self.dir)],
                              input='Task with 日本語 and spaces.\n', text=True, capture_output=True,
                              env=dict(self.env, **env), timeout=20)

    def test_default_preserves_prompt_and_read_only(self):
        result = self.run_seat()
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(self.capture.read_text())
        self.assertEqual(data['prompt'], 'Task with 日本語 and spaces.\n')
        self.assertIn('read-only', data['args'])
        self.assertIn('--skip-git-repo-check', data['args'])
        self.assertEqual(result.stdout, 'verified result')

    def test_browser_modes_keep_sandbox_and_task(self):
        for flags in [('--browser',), ('--browser', '--write'), ('--write', '--browser')]:
            with self.subTest(flags=flags):
                result = self.run_seat(flags)
                self.assertEqual(result.returncode, 0, result.stderr)
                data = json.loads(self.capture.read_text())
                sandbox = 'workspace-write' if '--write' in flags else 'read-only'
                self.assertEqual(data['args'][data['args'].index('--sandbox')+1], sandbox)
                self.assertTrue(data['prompt'].endswith('Task with 日本語 and spaces.\n'))
                self.assertIn('Browser/login task delegated from Claude', data['prompt'])
                self.assertNotIn('--dangerously-bypass-approvals-and-sandbox', data['args'])

    def test_bad_cua_stops_before_model_and_hides_diagnostic(self):
        for state in ['missing', 'disabled', 'filtered', 'denied']:
            with self.subTest(state=state):
                result = self.run_seat(('--browser',), TEST_CUA_STATE=state)
                self.assertEqual(result.returncode, 2)
                self.assertFalse(self.capture.exists())
                self.assertNotIn('SENSITIVE_DIAGNOSTIC', result.stdout + result.stderr)

    def test_browser_failure_withholds_raw_tool_output(self):
        result = self.run_seat(('--browser',), TEST_EXEC_FAIL='1')
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('SENSITIVE_DIAGNOSTIC', result.stdout + result.stderr)

    def test_unknown_flag_rejected(self):
        result = self.run_seat(('--unknown',))
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.capture.exists())


if __name__ == '__main__':
    unittest.main()
