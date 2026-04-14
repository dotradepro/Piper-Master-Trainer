"""Wrapper навколо piper.train: фіксить сумісність сторонніх checkpoint'ів.

Проблеми:
1. PyTorch 2.6+ зробив weights_only=True дефолтом → падіння на pathlib.PosixPath.
2. Lightning CLI при --ckpt_path читає hyper_parameters з checkpoint і застосовує
   їх як CLI аргументи. Сторонні/старі checkpoints мають hparams, яких немає в
   поточній версії piper (напр. sample_bytes, channels) → Subcommand 'fit' error.

Рішення: у патчі torch.load фільтруємо hparams, лишаючи лише ті, що є у
whitelist актуальних piper CLI опцій.
"""

import os
import pathlib
import runpy

import torch
import torch.serialization

torch.serialization.add_safe_globals(
    [pathlib.PosixPath, pathlib.WindowsPath, pathlib.PurePosixPath, pathlib.PurePath]
)

# Whitelist'и сформовані з актуального виводу `piper.train fit --help`.
# Якщо піпер оновить перелік — оновлюємо тут.
_MODEL_HPARAMS = {
    "sample_rate", "num_speakers",
    "resblock", "resblock_kernel_sizes", "resblock_dilation_sizes",
    "upsample_rates", "upsample_initial_channel", "upsample_kernel_sizes",
    "spec_channels", "mel_channels",
    "n_fft", "hop_length", "win_length",
    "mel_fmin", "mel_fmax",
    "inter_channels", "hidden_channels", "filter_channels",
    "n_heads", "n_layers", "kernel_size", "p_dropout", "n_layers_q",
    "use_spectral_norm", "gin_channels", "use_sdp",
    "segment_size",
    "learning_rate", "learning_rate_d",
    "betas", "betas_d", "eps",
    "lr_decay", "lr_decay_d",
    "init_lr_ratio", "warmup_epochs",
    "c_mel", "c_kl", "grad_clip",
    "vocoder_warmstart_ckpt", "dataset",
}

_DATA_HPARAMS = {
    "csv_path", "cache_dir", "espeak_voice", "config_path", "voice_name",
    "audio_dir", "alignments_dir", "num_symbols",
    "batch_size", "validation_split", "num_test_examples", "num_workers",
    "trim_silence", "keep_seconds_before_silence", "keep_seconds_after_silence",
    "phoneme_type", "dataset_type", "phonemes_path",
}


def _filter_hparams(section: dict, valid_keys: set) -> None:
    for k in list(section.keys()):
        if k not in valid_keys:
            section.pop(k, None)


_orig_load = torch.load


_FINETUNE_FRESH = os.environ.get("PIPER_FINETUNE_FRESH") == "1"


def _patched_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    result = _orig_load(*args, **kwargs)
    if isinstance(result, dict):
        hp = result.get("hyper_parameters")
        if isinstance(hp, dict):
            _filter_hparams(hp, _MODEL_HPARAMS)
        dhp = result.get("datamodule_hyper_parameters")
        if isinstance(dhp, dict):
            _filter_hparams(dhp, _DATA_HPARAMS)
        # Fresh finetune: скидаємо чужий optimizer state, loops, epoch counter.
        # Зберігаємо state_dict моделі. Lightning вимагає щоб ключі optimizer_states/
        # lr_schedulers існували — тому ставимо їх у [] (порожній список), тоді
        # цикл відновлення нічого не робить. Економить ~1.5 GiB VRAM.
        if _FINETUNE_FRESH:
            result["optimizer_states"] = []
            result["lr_schedulers"] = []
            for k in ("callbacks", "loops", "MixedPrecisionPlugin"):
                result.pop(k, None)
            result["epoch"] = 0
            result["global_step"] = 0
            print("[piper_train_entry] FRESH finetune: optimizer state cleared, epoch=0", flush=True)
    return result


torch.load = _patched_load

runpy.run_module("piper.train", run_name="__main__", alter_sys=True)
