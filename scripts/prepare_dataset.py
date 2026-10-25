import os
import json
import time
import requests
from PIL import Image, ImageEnhance

os.makedirs("static/images/cards", exist_ok=True)
os.makedirs("static/data", exist_ok=True)

HEADERS = {"User-Agent": "MyTarotApp/1.0 (Contact: admin@mytarot.local)"}

MAJOR_NAMES = [
    ("The Fool", "0", "Spontaneity, innocence, potential, new beginnings, leap of faith.", "Recklessness, risk-taking, naivety, foolishness, hesitation."),
    ("The Magician", "1", "Manifestation, resourcefulness, power, inspired action, skill.", "Illusion, manipulation, wasted talent, poor planning."),
    ("The High Priestess", "2", "Intuition, sacred knowledge, divine feminine, subconscious mind.", "Secrets, disconnected from intuition, withdrawal, silence."),
    ("The Empress", "3", "Femininity, beauty, nature, nurturing, abundance, fertility.", "Creative block, dependence, smothering, insecurity."),
    ("The Emperor", "4", "Authority, structure, stability, leadership, discipline.", "Tyranny, rigidity, coldness, lack of control, chaos."),
    ("The Hierophant", "5", "Spiritual wisdom, tradition, conformity, belief systems, guidance.", "Rebellion, unconventionality, rigidity, dogma, hypocrisy."),
    ("The Lovers", "6", "Love, harmony, relationships, values alignment, choices.", "Self-love, disharmony, imbalance, misaligned values."),
    ("The Chariot", "7", "Control, willpower, success, action, determination, ambition.", "Lack of control, opposition, aggression, directionlessness."),
    ("Strength", "8", "Courage, compassion, inner strength, patience, gentle power.", "Self-doubt, raw emotion, weakness, impatience."),
    ("The Hermit", "9", "Soul-searching, introspection, solitude, inner guidance.", "Isolation, loneliness, withdrawal, paranoia."),
    ("Wheel of Fortune", "10", "Good luck, destiny, change, karma, turning points.", "Bad luck, resistance to change, breaking cycles."),
    ("Justice", "11", "Justice, fairness, truth, cause and effect, law, integrity.", "Unfairness, dishonesty, lack of accountability, bias."),
    ("The Hanged Man", "12", "Pausing, surrender, letting go, new perspectives.", "Delays, resistance, stalling, useless sacrifice."),
    ("Death", "13", "Endings, change, transformation, transition, letting go.", "Resistance to change, fear of change, stagnation."),
    ("Temperance", "14", "Balance, moderation, patience, purpose, harmony.", "Imbalance, excess, self-healing, lack of patience."),
    ("The Devil", "15", "Shadow self, attachment, addiction, restriction, materialism.", "Releasing limiting beliefs, detachment, freedom, empowerment."),
    ("The Tower", "16", "Sudden change, upheaval, chaos, revelation, awakening.", "Avoidance of disaster, fear of suffering, delaying the inevitable."),
    ("The Star", "17", "Hope, faith, purpose, renewal, inspiration, tranquility.", "Lack of faith, despair, self-doubt, discouragement."),
    ("The Moon", "18", "Illusion, fear, anxiety, subconscious, intuition, dreams.", "Release of fear, repressed emotion, clarity, unveiling secrets."),
    ("The Sun", "19", "Positivity, fun, warmth, success, vitality, joy.", "Inner child, feeling down, temporary sadness, unrealistic optimism."),
    ("Judgement", "20", "Judgement, rebirth, inner calling, absolution, reflection.", "Self-doubt, harsh inner critic, ignoring the call."),
    ("The World", "21", "Completion, integration, accomplishment, travel, fulfillment.", "Seeking closure, unfinished business, short-cuts.")
]

# Suits configuration
SUITS = [
    ("wands", "Wands", "Wands", {
        "1": ("Ace of Wands", "Ace", "Creation, willpower, inspiration, desire, potential.", "Delay, lack of motivation, blockages, hesitation."),
        "2": ("Two of Wands", "2", "Future planning, progress, decisions, discovery.", "Fear of unknown, lack of planning, playing safe."),
        "3": ("Three of Wands", "3", "Expansion, foresight, overseas opportunities, progress.", "Playing safe, bad timing, lack of foresight, delays."),
        "4": ("Four of Wands", "4", "Celebration, joy, harmony, relaxation, home, community.", "Personal celebration, inner harmony, tension at home."),
        "5": ("Five of Wands", "5", "Conflict, competition, tension, diversity of opinions.", "Conflict resolution, agreement, avoiding conflict."),
        "6": ("Six of Wands", "6", "Success, public recognition, pride, victory.", "Ego, excess pride, lack of recognition, fall from grace."),
        "7": ("Seven of Wands", "7", "Challenge, perseverance, defense, standing ground.", "Giving up, overwhelmed, defensive, admitting defeat."),
        "8": ("Eight of Wands", "8", "Speed, action, fast movement, travel, quick decisions.", "Delays, frustration, acting without thinking, panic."),
        "9": ("Nine of Wands", "9", "Resilience, courage, persistence, test of faith.", "Exhaustion, fatigue, giving up, defensive wall."),
        "10": ("Ten of Wands", "10", "Burden, extra responsibility, stress, accomplishment.", "Delegating, relief, taking on too much, burnout."),
        "11": ("Page of Wands", "Page", "Inspiration, ideas, discovery, free spirit, enthusiasm.", "Lack of direction, procrastination, eagerness without action."),
        "12": ("Knight of Wands", "Knight", "Energy, passion, inspired action, adventure, impulsiveness.", "Passion project, rush, haste, reckless behavior."),
        "13": ("Queen of Wands", "Queen", "Courage, confidence, independence, charisma, determination.", "Self-respect, jealousy, demanding, insecurity."),
        "14": ("King of Wands", "King", "Natural-born leader, vision, entrepreneur, honor.", "Impulsiveness, high expectations, dictatorial, domineering.")
    }),
    ("cups", "Cups", "Cups", {
        "1": ("Ace of Cups", "Ace", "Love, new feelings, compassion, creativity, intuition.", "Self-love, intuition blocked, emotional loss, sadness."),
        "2": ("Two of Cups", "2", "Unified love, partnership, mutual attraction, connection.", "Self-love, break-up, disharmony, mistrust."),
        "3": ("Three of Cups", "3", "Friendship, celebration, group creative project, collaboration.", "Independence, solitude, gossip, overindulgence."),
        "4": ("Four of Cups", "4", "Apathy, contemplation, disconnectedness, boredom.", "Clarity, awareness, acceptance, moving forward."),
        "5": ("Five of Cups", "5", "Regret, failure, disappointment, pessimism, grief.", "Personal setbacks, self-forgiveness, moving on."),
        "6": ("Six of Cups", "6", "Nostalgia, memories, innocence, joy, reunion.", "Living in the past, moving forward, leaving home."),
        "7": ("Seven of Cups", "7", "Opportunities, choices, illusion, wishful thinking.", "Alignment, personal values, overwhelmed by choices."),
        "8": ("Eight of Cups", "8", "Disillusionment, leaving behind, walking away, truth.", "Trying one more time, fear of change, stagnation."),
        "9": ("Nine of Cups", "9", "Contentment, satisfaction, gratitude, wish fulfilled.", "Inner happiness, materialism, dissatisfaction, greed."),
        "10": ("Ten of Cups", "10", "Divine love, blissful relationships, harmony, alignment.", "Misaligned values, broken home, domestic conflict."),
        "11": ("Page of Cups", "Page", "Creative opportunities, intuitive messages, curiosity.", "Emotional immaturity, creative block, moodiness."),
        "12": ("Knight of Cups", "Knight", "Creativity, romance, charm, imagination, beauty.", "Overly emotional, unrealistic, moody, jealousy."),
        "13": ("Queen of Cups", "Queen", "Compassionate, caring, emotionally stable, intuitive.", "Inner emotional strength, codependency, martyrdom."),
        "14": ("King of Cups", "King", "Emotionally balanced, compassionate, diplomatic, wise.", "Self-compassion, emotional manipulation, moodiness.")
    }),
    ("swords", "Swords", "Swords", {
        "1": ("Ace of Swords", "Ace", "Breakthroughs, new ideas, mental clarity, success.", "Confusion, chaos, lack of clarity, bad decisions."),
        "2": ("Two of Swords", "2", "Difficult choices, indecision, stalemate, avoidance.", "Indecision, confusion, information overload, truth revealed."),
        "3": ("Three of Swords", "3", "Heartbreak, emotional pain, sorrow, grief, hurt.", "Negative self-talk, releasing pain, forgiveness, recovery."),
        "4": ("Four of Swords", "4", "Rest, relaxation, meditation, contemplation, recuperation.", "Exhaustion, burnout, stress, deep contemplation."),
        "5": ("Five of Swords", "5", "Conflict, competition, win at all costs, hostility.", "Reconciliation, forgiving, holding a grudge, resolution."),
        "6": ("Six of Swords", "6", "Transition, change, rite of passage, releasing baggage.", "Personal transition, resistance to change, unfinished business."),
        "7": ("Seven of Swords", "7", "Betrayal, deception, getting away with something, strategy.", "Imposter syndrome, self-deception, turning over a new leaf."),
        "8": ("Eight of Swords", "8", "Self-imposed restriction, victim mentality, helplessness.", "Self-limiting beliefs, inner critic, freedom, open eyes."),
        "9": ("Nine of Swords", "9", "Anxiety, worry, fear, nightmares, distress.", "Deep-seated fears, despair, inner turmoil, reaching out."),
        "10": ("Ten of Swords", "10", "Painful endings, deep wounds, betrayal, rock bottom.", "Recovery, regeneration, resisting an inevitable end."),
        "11": ("Page of Swords", "Page", "New ideas, curiosity, thirst for knowledge, new communication.", "All talk and no action, haste, gossip, cynicism."),
        "12": ("Knight of Swords", "Knight", "Ambitious, action-oriented, driven, fast-thinking.", "Restless, unfocused, impulsive, aggressive, burn-out."),
        "13": ("Queen of Swords", "Queen", "Independent, unbiased judgement, clear boundaries, direct.", "Overly critical, harsh, cold-hearted, bitter."),
        "14": ("King of Swords", "King", "Mental clarity, intellectual power, authority, truth.", "Quiet power, inner truth, misuse of power, manipulative.")
    }),
    ("pentacles", "Pentacles", "Pents", {
        "1": ("Ace of Pentacles", "Ace", "A new financial or career opportunity, manifestation, abundance.", "Lost opportunity, bad investment, lack of planning."),
        "2": ("Two of Pentacles", "2", "Multiple priorities, time management, adaptability, balance.", "Overwhelmed, disorganization, financial stress."),
        "3": ("Three of Pentacles", "3", "Teamwork, collaboration, learning, implementation, skill.", "Lack of teamwork, disorganization, solo effort, competition."),
        "4": ("Four of Pentacles", "4", "Saving money, security, conservatism, scarcity mindset.", "Over-spending, greed, letting go, generosity."),
        "5": ("Five of Pentacles", "5", "Financial loss, poverty mindset, isolation, worry.", "Recovery from financial loss, spiritual poverty, hope."),
        "6": ("Six of Pentacles", "6", "Giving, receiving, sharing wealth, generosity, charity.", "Self-care, debt, stinginess, one-sided charity."),
        "7": ("Seven of Pentacles", "7", "Long-term view, sustainable results, perseverance, investment.", "Lack of long-term vision, limited success, distraction."),
        "8": ("Eight of Pentacles", "8", "Apprenticeship, repetitive tasks, mastery, skill development.", "Self-development, perfectionism, lack of focus, rushing."),
        "9": ("Nine of Pentacles", "9", "Abundance, luxury, self-sufficiency, financial independence.", "Self-worth, over-investment, hustle without reward."),
        "10": ("Ten of Pentacles", "10", "Wealth, financial security, family, long-term success.", "Financial failure, family conflict, loss of stability."),
        "11": ("Page of Pentacles", "Page", "Manifestation, financial opportunity, skill building, enthusiasm.", "Lack of progress, procrastination, failed goals."),
        "12": ("Knight of Pentacles", "Knight", "Hard work, productivity, routine, conservatism, patience.", "Self-discipline, boredom, feeling stuck, perfectionism."),
        "13": ("Queen of Pentacles", "Queen", "Nurturing, practical, providing financially, working parent.", "Financial independence, self-care, work-home balance."),
        "14": ("King of Pentacles", "King", "Wealth, business prowess, leadership, security, discipline.", "Financial incompetence, greed, materialistic, stubborn.")
    })
]

def get_wikimedia_url(title):
    url = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": f"File:{title}",
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json"
    }
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=15)
        pages = r.json().get("query", {}).get("pages", {})
        for pid, page in pages.items():
            imageinfo = page.get("imageinfo", [])
            if imageinfo:
                return imageinfo[0].get("url")
    except Exception as e:
        print(f"Error fetching URL for {title}: {e}")
    return None

def download_and_boost_image(img_url, output_path):
    time.sleep(0.3)
    try:
        r = requests.get(img_url, headers=HEADERS, timeout=20)
        if r.status_code == 200 and len(r.content) > 1000:
            with open(output_path, "wb") as f:
                f.write(r.content)
            # Enhance image quality (color saturation & contrast boost)
            with Image.open(output_path) as img:
                img = img.convert("RGB")
                img = ImageEnhance.Color(img).enhance(1.25)
                img = ImageEnhance.Contrast(img).enhance(1.1)
                img.save(output_path, quality=95)
            return True
    except Exception as e:
        print(f"Failed to download/process {img_url}: {e}")
    return False

def main():
    dataset = []

    # 1. Build Major Arcana (Full Color Pam-A 1909 RWS scans)
    for idx, (name, val, up, rev) in enumerate(MAJOR_NAMES):
        num_str = f"{idx:02d}"
        clean_name = name.replace("The ", "")
        wiki_title = f"RWS Tarot {num_str} {clean_name}.jpg"
        
        img_url = get_wikimedia_url(wiki_title)
        if not img_url:
            # Fallback title search
            wiki_title = f"RWS Tarot {num_str} {name}.jpg"
            img_url = get_wikimedia_url(wiki_title)

        file_basename = f"major_{idx:02d}.jpg"
        local_path = os.path.join("static/images/cards", file_basename)
        
        if img_url:
            success = download_and_boost_image(img_url, local_path)
            print(f"Saved Major Card {idx} ({name}): Color={success}")
        else:
            print(f"WARNING: Image URL not found for Major card {idx}: {name}")

        card_obj = {
            "id": f"major_{idx}",
            "name": name,
            "type": "major",
            "suit": "major",
            "rank": str(idx),
            "is_royal": False,
            "meaning_upright": up,
            "meaning_reversed": rev,
            "image_path": f"/static/images/cards/{file_basename}"
        }
        dataset.append(card_obj)

    # 2. Build Minor Arcana (Full Color 1909 RWS scans)
    for suit_key, suit_name, wiki_prefix, cards_dict in SUITS:
        for rank_num_str, (card_name, rank_label, up, rev) in cards_dict.items():
            val_int = int(rank_num_str)
            num_str = f"{val_int:02d}"
            
            wiki_title = f"{wiki_prefix}{num_str}.jpg"
            img_url = get_wikimedia_url(wiki_title)
            
            file_basename = f"{suit_key}_{num_str}.jpg"
            local_path = os.path.join("static/images/cards", file_basename)
            
            if img_url:
                success = download_and_boost_image(img_url, local_path)
                print(f"Saved {suit_name} {num_str} ({card_name}): Color={success}")
            else:
                print(f"WARNING: Image URL not found for {suit_name} {num_str}")
            
            is_royal = rank_label in ["Page", "Knight", "Queen", "King"]
            
            card_obj = {
                "id": f"{suit_key}_{val_int}",
                "name": card_name,
                "type": "minor",
                "suit": suit_key,
                "rank": rank_label,
                "is_royal": is_royal,
                "meaning_upright": up,
                "meaning_reversed": rev,
                "image_path": f"/static/images/cards/{file_basename}"
            }
            dataset.append(card_obj)

    # Save JSON dataset
    with open("static/data/tarot_dataset.json", "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)

    print(f"Tarot Full-Color Dataset built successfully with {len(dataset)} cards!")

if __name__ == "__main__":
    main()
