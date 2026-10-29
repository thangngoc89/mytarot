#!/usr/bin/env python3
"""Download, normalize, and sharpen additional full 78-card tarot decks into static/images/decks/<deck_id>/."""

import os
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECKS_DIR = os.path.join(BASE_DIR, "static", "images", "decks")

HEADERS = {"User-Agent": "MyTarotApp/1.0"}

SOIMOI_MAJORS = [
    "00_Fool.jpg", "01_Magician.jpg", "02_High_Priestess.jpg", "03_Empress.jpg",
    "04_Emperor.jpg", "05_Hierophant.jpg", "06_Lovers.jpg", "07_Chariot.jpg",
    "08_Strength.jpg", "09_Hermit.jpg", "10_Wheel_of_Fortune.jpg", "11_Justice.jpg",
    "12_Hanged_Man.jpg", "13_Death.jpg", "14_Temperance.jpg", "15_Devil.jpg",
    "16_Tower.jpg", "17_Star.jpg", "18_Moon.jpg", "19_Sun.jpg",
    "20_Judgement.jpg", "21_World.jpg"
]

WOODLAND_MAJORS = [
    "愚者.jpeg", "魔術師.jpeg", "女教皇.jpeg", "女帝.jpeg",
    "皇帝.jpeg", "法王.jpeg", "恋人たち.jpeg", "戦車.jpeg",
    "力.jpeg", "隠者.jpeg", "運命の輪.jpeg", "正義.jpeg",
    "吊された男.jpeg", "死神.jpeg", "節制.jpeg", "悪魔.jpeg",
    "塔.jpeg", "星.jpeg", "月.jpeg", "太陽.jpeg",
    "審判.jpeg", "世界.jpeg"
]

WOODLAND_SUITS = {
    "wands": "ワンド",
    "cups": "カップ",
    "swords": "ソード",
    "pentacles": "ペンタクル",
}


def build_tasks():
    tasks = []  # (deck_id, target_filename, url)

    # 1. Celestial Gold (reginanka/tarot-cards, CC BY 4.0)
    # Note: Reginanka followed Marseille numbering (m08=Justice, m11=Strength).
    # We map m11 -> major_08 (Strength) and m08 -> major_11 (Justice) to align with RWS IDs.
    cg_base = "https://raw.githubusercontent.com/reginanka/tarot-cards/main/cards"
    for i in range(22):
        src_i = 11 if i == 8 else (8 if i == 11 else i)
        tasks.append(("celestial-gold", f"major_{i:02d}.jpg", f"{cg_base}/m{src_i:02d}.webp"))
    cg_suits = {"wands": "w", "cups": "c", "swords": "s", "pentacles": "p"}
    for suit_key, prefix in cg_suits.items():
        for rank in range(1, 15):
            tasks.append(("celestial-gold", f"{suit_key}_{rank:02d}.jpg", f"{cg_base}/{prefix}{rank:02d}.webp"))

    # 2. Soimoi (Mike Koz, CC BY 4.0)
    sm_base = "https://raw.githubusercontent.com/mixvlad/TarotCards/main/tarot/soimoi/720px"
    for i, fname in enumerate(SOIMOI_MAJORS):
        tasks.append(("soimoi", f"major_{i:02d}.jpg", f"{sm_base}/{fname}"))
    sm_suits = {"wands": "Wands", "cups": "Cups", "swords": "Swords", "pentacles": "Pents"}
    for suit_key, prefix in sm_suits.items():
        for rank in range(1, 15):
            tasks.append(("soimoi", f"{suit_key}_{rank:02d}.jpg", f"{sm_base}/{prefix}{rank:02d}.jpg"))

    # 3. Storybook Woodland Animal Tarot (maemaekaachan-beep/animal-tarot-images)
    wa_base = "https://raw.githubusercontent.com/maemaekaachan-beep/animal-tarot-images/main"
    for i, fname in enumerate(WOODLAND_MAJORS):
        tasks.append(("woodland-animal", f"major_{i:02d}.jpg", f"{wa_base}/{urllib.parse.quote(fname)}"))
    for suit_key, jp_suit in WOODLAND_SUITS.items():
        tasks.append(("woodland-animal", f"{suit_key}_01.jpg", f"{wa_base}/{urllib.parse.quote(f'{jp_suit}のA.jpeg')}"))
        for rank in range(2, 11):
            tasks.append(("woodland-animal", f"{suit_key}_{rank:02d}.jpg", f"{wa_base}/{urllib.parse.quote(f'{jp_suit}の{rank}.jpeg')}"))
        courts = [
            (11, f"{jp_suit}のペイジ.jpeg"),
            (12, f"{jp_suit}のナイト.jpeg"),
            (13, f"{jp_suit}のクイーン.jpeg"),
            (14, f"{jp_suit}のキング.jpeg"),
        ]
        for rank, fname in courts:
            tasks.append(("woodland-animal", f"{suit_key}_{rank:02d}.jpg", f"{wa_base}/{urllib.parse.quote(fname)}"))

    return tasks


def enhance_card_bgr(img_bgr, deck_id):
    """Apply artwork unsharp masking & local contrast pop, plus deck-specific framing/typography enhancement."""
    h, w, _ = img_bgr.shape

    if deck_id == "celestial-gold":
        # Split into artwork region (top 88.5%) and bottom nameplate banner (bottom 11.5%)
        split_y = int(h * 0.885)
        art = img_bgr[:split_y, :].copy()
        banner = img_bgr[split_y:, :].copy()

        # 1. Artwork: CLAHE local detail pop + Unsharp Mask
        lab = cv2.cvtColor(art, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.35, tileGridSize=(8, 8))
        l_clahe = clahe.apply(l)
        art_vivid = cv2.cvtColor(cv2.merge([l_clahe, a, b]), cv2.COLOR_LAB2BGR)

        blur_art = cv2.GaussianBlur(art_vivid, (0, 0), sigmaX=1.5)
        art_sharp = cv2.addWeighted(art_vivid, 1.55, blur_art, -0.55, 0)

        # 2. Bottom text banner: reinforce thin serif character strokes so downscaling never blurs or drops them
        kernel = np.ones((2, 2), np.uint8)
        eroded = cv2.erode(banner, kernel, iterations=1)
        gray_banner = cv2.cvtColor(banner, cv2.COLOR_BGR2GRAY)
        text_mask = (gray_banner < 140).astype(np.float32)[:, :, None]
        banner_reinforced = (
            banner.astype(np.float32) * (1.0 - 0.65 * text_mask)
            + eroded.astype(np.float32) * (0.65 * text_mask)
        ).astype(np.uint8)
        blur_ban = cv2.GaussianBlur(banner_reinforced, (0, 0), sigmaX=1.0)
        banner_sharp = cv2.addWeighted(banner_reinforced, 1.6, blur_ban, -0.6, 0)

        return np.vstack([art_sharp, banner_sharp])

    elif deck_id == "woodland-animal":
        # Enhance 1024x1024 square card and mount cleanly inside a 1024x1536 (2:3) celestial navy & gold frame
        if (w, h) != (1024, 1024):
            img_bgr = cv2.resize(img_bgr, (1024, 1024), interpolation=cv2.INTER_AREA)

        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.30, tileGridSize=(8, 8))
        l_clahe = clahe.apply(l)
        vivid = cv2.cvtColor(cv2.merge([l_clahe, a, b]), cv2.COLOR_LAB2BGR)
        blur = cv2.GaussianBlur(vivid, (0, 0), sigmaX=1.4)
        sharp = cv2.addWeighted(vivid, 1.45, blur, -0.45, 0)

        canvas = np.zeros((1536, 1024, 3), dtype=np.uint8)
        for y in range(1536):
            t = abs(y - 768) / 768.0
            canvas[y, :] = (
                int(48 * (1 - 0.35 * t)),
                int(24 * (1 - 0.35 * t)),
                int(14 * (1 - 0.35 * t)),
            )

        y0 = 256
        canvas[y0:y0 + 1024, 0:1024] = sharp

        gold = (115, 195, 238)
        gold_dim = (75, 135, 175)
        cv2.rectangle(canvas, (12, 12), (1011, 1523), gold, 4)
        cv2.rectangle(canvas, (26, 26), (997, 1509), gold_dim, 2)
        cv2.rectangle(canvas, (44, 44), (979, y0 - 20), gold_dim, 2)
        cv2.rectangle(canvas, (44, y0 + 1024 + 20), (979, 1491), gold_dim, 2)

        for cy in [140, 1396]:
            cx = 512
            pts = np.array([
                [cx, cy - 36], [cx + 10, cy - 10], [cx + 36, cy], [cx + 10, cy + 10],
                [cx, cy + 36], [cx - 10, cy + 10], [cx - 36, cy], [cx - 10, cy - 10]
            ], np.int32)
            cv2.fillPoly(canvas, [pts], gold)
            cv2.circle(canvas, (cx - 90, cy), 5, gold_dim, -1)
            cv2.circle(canvas, (cx + 90, cy), 5, gold_dim, -1)
            cv2.line(canvas, (cx - 260, cy), (cx - 110, cy), gold_dim, 2)
            cv2.line(canvas, (cx + 110, cy), (cx + 260, cy), gold_dim, 2)

        return canvas

    else:
        # Full-bleed artwork (Soimoi): CLAHE + Unsharp Mask
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.30, tileGridSize=(8, 8))
        l_clahe = clahe.apply(l)
        art_vivid = cv2.cvtColor(cv2.merge([l_clahe, a, b]), cv2.COLOR_LAB2BGR)

        blur_art = cv2.GaussianBlur(art_vivid, (0, 0), sigmaX=1.5)
        return cv2.addWeighted(art_vivid, 1.45, blur_art, -0.45, 0)


def process_card(task):
    deck_id, target_filename, url = task
    out_dir = os.path.join(DECKS_DIR, deck_id)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, target_filename)

    if os.path.exists(out_path) and os.path.getsize(out_path) > 5000:
        return (deck_id, target_filename, True, "cached")

    img_bgr = None
    for _ in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            if r.status_code == 200 and len(r.content) > 1000:
                arr = np.frombuffer(r.content, dtype=np.uint8)
                img_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img_bgr is not None:
                    break
        except Exception:
            pass

    if img_bgr is None:
        return (deck_id, target_filename, False, f"failed: {url}")

    enhanced = enhance_card_bgr(img_bgr, deck_id)
    cv2.imwrite(out_path, enhanced, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return (deck_id, target_filename, True, "enhanced")


def main():
    tasks = build_tasks()
    print(f"Processing {len(tasks)} cards across Celestial Gold, Soimoi & Woodland Animal decks...")
    counts = {}
    failures = []

    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = [pool.submit(process_card, t) for t in tasks]
        for fut in as_completed(futures):
            deck_id, fname, ok, msg = fut.result()
            counts.setdefault(deck_id, 0)
            if ok:
                counts[deck_id] += 1
            else:
                failures.append((deck_id, fname, msg))

    for deck_id, cnt in sorted(counts.items()):
        print(f"Deck '{deck_id}': {cnt}/78 cards ready")
    if failures:
        print("Failures:", failures)
    else:
        print("All 3 extra decks (234 cards) ready!")


if __name__ == "__main__":
    main()
