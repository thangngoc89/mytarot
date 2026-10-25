import os
import time
import glob
import cv2
import numpy as np

SRC_DIR = "static/images/cards"
OUT_DIR_STATIC = "static/images/cleaned-deck"
OUT_DIR_ASSETS = "assets/cleaned-deck"

os.makedirs(OUT_DIR_STATIC, exist_ok=True)
os.makedirs(OUT_DIR_ASSETS, exist_ok=True)
os.makedirs("assets", exist_ok=True)

def process_card_image(image_path, is_diagnostic=False):
    start_time = time.time()
    
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        return None, 0.0, None
    
    h, w, _ = img_bgr.shape

    # 1. Convert to YCrCb space to separate Luminance (Y) and Chrominance (Cr, Cb)
    ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)
    y_chan, cr_chan, cb_chan = cv2.split(ycrcb)

    # 2. Fast Fourier Transform (FFT) on Y channel for Moiré & Scanning Stripe Removal
    dft = np.fft.fft2(y_chan.astype(np.float32))
    dft_shift = np.fft.fftshift(dft)
    magnitude_spectrum = 20 * np.log(np.abs(dft_shift) + 1e-8)
    
    cy, cx = h // 2, w // 2
    Y_grid, X_grid = np.ogrid[:h, :w]
    dist2_center = (X_grid - cx)**2 + (Y_grid - cy)**2
    r_center = int(min(h, w) * 0.08)

    # Isolate frequency spikes outside central hub
    mag_masked = magnitude_spectrum.copy()
    mag_masked[dist2_center < (r_center ** 2)] = 0

    # Extract top 30 frequency noise spikes
    num_spikes = 30
    flat_indices = np.argpartition(mag_masked.ravel(), -num_spikes)[-num_spikes:]
    spike_coords = np.column_stack(np.unravel_index(flat_indices, mag_masked.shape))

    # Construct Gaussian Notch Filter Mask
    notch_mask = np.ones((h, w), dtype=np.float32)
    for ys, xs in spike_coords:
        d2 = (X_grid - xs)**2 + (Y_grid - ys)**2
        notch_mask *= (1.0 - np.exp(-0.5 * (d2 / 16.0)))

    # Compute Inverse FFT to spatial domain
    dft_shift_filtered = dft_shift * notch_mask
    dft_ishift = np.fft.ifftshift(dft_shift_filtered)
    y_fft_filtered = np.abs(np.fft.ifft2(dft_ishift))
    y_fft_filtered = np.clip(y_fft_filtered, 0, 255).astype(np.uint8)

    # 3. Halftone Descreening via Selective Bilateral Filtering
    y_descreened = cv2.bilateralFilter(y_fft_filtered, d=7, sigmaColor=30, sigmaSpace=7)
    cr_descreened = cv2.bilateralFilter(cr_chan, d=7, sigmaColor=25, sigmaSpace=7)
    cb_descreened = cv2.bilateralFilter(cb_chan, d=7, sigmaColor=25, sigmaSpace=7)

    cleaned_ycrcb = cv2.merge([y_descreened, cr_descreened, cb_descreened])
    cleaned_bgr = cv2.cvtColor(cleaned_ycrcb, cv2.COLOR_YCrCb2BGR)

    # 4. Linework Sharpness Preservation
    # Extract dark ink linework mask from raw image using adaptive thresholding
    gray_raw = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    dark_ink_mask = (gray_raw < 70).astype(np.float32)
    dark_ink_mask = cv2.GaussianBlur(dark_ink_mask, (3, 3), 0)

    # Composite sharp dark linework back over cleaned color background
    final_bgr = cleaned_bgr.copy()
    for c in range(3):
        raw_c = img_bgr[:, :, c].astype(np.float32)
        clean_c = cleaned_bgr[:, :, c].astype(np.float32)
        blend = dark_ink_mask * 0.85
        blended = clean_c * (1.0 - blend) + np.minimum(raw_c, clean_c) * blend
        final_bgr[:, :, c] = np.clip(blended, 0, 255).astype(np.uint8)

    # 5. Brightness, Contrast & Saturation Enhancement (LAB & HSV Space)
    lab = cv2.cvtColor(final_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) for detail pop
    clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
    l_clahe = clahe.apply(l)
    
    # Boost brightness smoothly on L channel
    l_bright = cv2.addWeighted(l_clahe, 1.12, l_clahe, 0, 12)
    l_bright = np.clip(l_bright, 0, 255).astype(np.uint8)
    
    lab_bright = cv2.merge([l_bright, a, b])
    bright_bgr = cv2.cvtColor(lab_bright, cv2.COLOR_LAB2BGR)

    # Boost Saturation slightly in HSV for rich tarot colors
    hsv = cv2.cvtColor(bright_bgr, cv2.COLOR_BGR2HSV)
    h_chan, s_chan, v_chan = cv2.split(hsv)
    s_boosted = cv2.addWeighted(s_chan, 1.12, s_chan, 0, 5)
    s_boosted = np.clip(s_boosted, 0, 255).astype(np.uint8)
    hsv_boosted = cv2.merge([h_chan, s_boosted, v_chan])
    vivid_bgr = cv2.cvtColor(hsv_boosted, cv2.COLOR_HSV2BGR)

    # 6. High-Resolution Sharpness Enhancement (Unsharp Masking)
    blurred = cv2.GaussianBlur(vivid_bgr, (0, 0), sigmaX=2.0)
    sharpened = cv2.addWeighted(vivid_bgr, 1.45, blurred, -0.45, 0)
    final_output = np.clip(sharpened, 0, 255).astype(np.uint8)

    elapsed = time.time() - start_time

    # Build 3-panel Diagnostic Visualization if requested
    diag_vis = None
    if is_diagnostic:
        mag_norm = (magnitude_spectrum - magnitude_spectrum.min()) / (magnitude_spectrum.max() - magnitude_spectrum.min() + 1e-8)
        spec_vis = (mag_norm * 255).astype(np.uint8)
        spec_vis_color = cv2.applyColorMap(spec_vis, cv2.COLORMAP_JET)

        # Highlight notch mask positions in spectrum visualization
        mask_overlay = ((1.0 - notch_mask) * 255).astype(np.uint8)
        spec_vis_color[mask_overlay > 50] = [255, 255, 255]

        h_panel = 500
        w_panel = int(w * (h_panel / h))

        p1 = cv2.resize(img_bgr, (w_panel, h_panel))
        p2 = cv2.resize(spec_vis_color, (w_panel, h_panel))
        p3 = cv2.resize(final_output, (w_panel, h_panel))

        def add_label(img, label):
            res = img.copy()
            cv2.rectangle(res, (0, 0), (w_panel, 35), (20, 25, 35), -1)
            cv2.putText(res, label, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (240, 245, 255), 2)
            return res

        p1 = add_label(p1, "[Original Raw Scan]")
        p2 = add_label(p2, "[FFT Spectrum Mask]")
        p3 = add_label(p3, "[Cleaned & Brightened Output]")

        diag_vis = np.hstack([p1, p2, p3])

    return final_output, elapsed, diag_vis

def main():
    image_paths = sorted(glob.glob(os.path.join(SRC_DIR, "*.jpg")) + glob.glob(os.path.join(SRC_DIR, "*.png")))
    if not image_paths:
        print(f"No source images found in {SRC_DIR}", flush=True)
        return

    print(f"Starting batch cleaning of {len(image_paths)} Tarot card raw scans...\n", flush=True)
    print(f"{'Filename':<25} | {'Status':<10} | {'Processing Time':<15}", flush=True)
    print("-" * 58, flush=True)

    total_time = 0.0
    processed_count = 0
    first_diag_saved = False

    for idx, path in enumerate(image_paths):
        file_basename = os.path.basename(path)
        is_fool = (idx == 0) or ("major_00" in file_basename) or ("fool" in file_basename.lower())

        cleaned_bgr, elapsed, diag_vis = process_card_image(path, is_diagnostic=is_fool)
        if cleaned_bgr is not None:
            out_static_path = os.path.join(OUT_DIR_STATIC, file_basename)
            out_assets_path = os.path.join(OUT_DIR_ASSETS, file_basename)

            cv2.imwrite(out_static_path, cleaned_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
            cv2.imwrite(out_assets_path, cleaned_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])

            total_time += elapsed
            processed_count += 1
            print(f"{file_basename:<25} | {'SUCCESS':<10} | {elapsed:.3f} seconds", flush=True)

            if is_fool and diag_vis is not None and not first_diag_saved:
                cv2.imwrite("static/images/00_the_fool_diagnostic.png", diag_vis)
                cv2.imwrite("assets/00_the_fool_diagnostic.png", diag_vis)
                first_diag_saved = True
                print(f"  └─ Saved diagnostic output: 00_the_fool_diagnostic.png", flush=True)
        else:
            print(f"{file_basename:<25} | {'FAILED':<10} | N/A", flush=True)

    avg_time = total_time / max(processed_count, 1)
    print("-" * 58, flush=True)
    print(f"\nBatch processing complete!", flush=True)
    print(f"Total Cards Processed: {processed_count}/{len(image_paths)}", flush=True)
    print(f"Total Processing Time: {total_time:.2f} seconds", flush=True)
    print(f"Average Time Per Card: {avg_time:.3f} seconds", flush=True)
    print(f"Cleaned assets saved to: {OUT_DIR_STATIC} and {OUT_DIR_ASSETS}", flush=True)

if __name__ == "__main__":
    main()
