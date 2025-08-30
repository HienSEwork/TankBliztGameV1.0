from pydub.generators import Sine, WhiteNoise
from pydub import AudioSegment

# Bắn (shoot) - tone cao, ngắn
shoot = Sine(800).to_audio_segment(duration=80).fade_out(50)
shoot.export("shoot.mp3", format="mp3")

# Nổ (explosion) - noise trầm + fade
explosion = WhiteNoise().to_audio_segment(duration=600).low_pass_filter(200).fade_out(400)
explosion.export("explosion.mp3", format="mp3")

# Boss spawn (đùng đùng)
boss_spawn = Sine(60).to_audio_segment(duration=200).overlay(
    Sine(120).to_audio_segment(duration=200)
).append(Sine(40).to_audio_segment(duration=300), crossfade=100).fade_out(300)
boss_spawn.export("boss_spawn.mp3", format="mp3")

# Shark spawn (xoáy nước) - white noise modulated
shark_spawn = WhiteNoise().to_audio_segment(duration=2000).high_pass_filter(400).fade_out(1500)
shark_spawn.export("shark_spawn.mp3", format="mp3")

# Menu BGM (loop chậm)
menu_bgm = Sine(220).to_audio_segment(duration=400).append(
    Sine(440).to_audio_segment(duration=400), crossfade=50
).append(Sine(330).to_audio_segment(duration=400), crossfade=50)
menu_bgm = menu_bgm * 10  # lặp 10 lần
menu_bgm.export("menu_bgm.mp3", format="mp3")

# Game BGM (nhanh, dồn dập)
game_bgm = (Sine(330).to_audio_segment(duration=200).append(
    Sine(660).to_audio_segment(duration=200), crossfade=50
) * 30)
game_bgm.export("game_bgm.mp3", format="mp3")

print("✅ Đã tạo xong 6 file mp3")
