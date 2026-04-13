"""Wrapper that runs piper training with our MetricsFileCallback injected."""

import sys
import json
from pathlib import Path


def main():
    """Run piper.train.fit with MetricsFileCallback injected."""
    # Parse our custom arg
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

    # Import piper training components
    from piper.train.__main__ import VitsLightningCLI
    from app.utils.training_callback import MetricsFileCallback

    # Inject callback into sys.argv for LightningCLI
    sys.argv = ["train"] + piper_args

    # We need to hook into the CLI to add our callback
    # LightningCLI creates trainer internally, so we monkeypatch
    import lightning.pytorch as pl
    original_init = pl.Trainer.__init__

    def patched_init(self, *a, **kw):
        # Add our callback
        callbacks = kw.get("callbacks") or []
        if not isinstance(callbacks, list):
            callbacks = list(callbacks)
        callbacks.append(MetricsFileCallback(metrics_path))
        kw["callbacks"] = callbacks
        original_init(self, *a, **kw)

    pl.Trainer.__init__ = patched_init

    try:
        VitsLightningCLI()
    finally:
        pl.Trainer.__init__ = original_init


if __name__ == "__main__":
    main()
