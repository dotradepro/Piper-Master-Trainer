"""Wrapper: запускає piper.train з MetricsFileCallback через monkeypatch."""

import sys
import os


def main():
    metrics_path = None
    piper_args = []
    i = 0
    args = sys.argv[1:]
    while i < len(args):
        if args[i] == "--metrics-file":
            metrics_path = args[i + 1]
            i += 2
        else:
            piper_args.append(args[i])
            i += 1

    if not metrics_path:
        print("ERROR: --metrics-file required", file=sys.stderr)
        sys.exit(1)

    # Monkeypatch Trainer.fit to inject our callback BEFORE piper imports anything
    import lightning.pytorch as pl
    from app.utils.training_callback import MetricsFileCallback

    _orig_fit = pl.Trainer.fit

    def _patched_fit(self, *a, **kw):
        # Inject callback into trainer
        if not any(isinstance(c, MetricsFileCallback) for c in self.callbacks):
            self.callbacks.append(MetricsFileCallback(metrics_path))
        return _orig_fit(self, *a, **kw)

    pl.Trainer.fit = _patched_fit

    # Now run piper.train as if called directly
    sys.argv = ["piper.train"] + piper_args
    from piper.train.__main__ import main as piper_main
    piper_main()


if __name__ == "__main__":
    main()
