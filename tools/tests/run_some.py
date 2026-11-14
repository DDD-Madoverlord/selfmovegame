"""검사 몇 개만 이름으로 골라 돌리기: python tools/tests/run_some.py test_groups test_growth ...
(run_all.py는 이름 한 조각으로만 거를 수 있어서 — 바꾼 곳과 관련된 검사만 빨리 돌릴 때)"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import run_tests  # noqa: E402


def main():
    names = [n[:-3] if n.endswith('.py') else n for n in sys.argv[1:]]
    if not names:
        print('쓰는 법: python tools/tests/run_some.py test_a test_b ...')
        sys.exit(2)
    npass, nfail, lines = run_tests([importlib.import_module(n) for n in names])
    print('\n'.join(lines))
    print(f'\n== 통과 {npass} / 실패 {nfail} ==')
    sys.exit(1 if nfail else 0)


if __name__ == '__main__':
    main()
