import whisper
import os

# Define the path to the audio file
audio_path = "/Users/luizfernandotoledo/Desktop/South Way 27 (1).m4a"

# Load the model
# Using "large" model for optimal quality as requested
print("Loading Whisper model (large)... This may take a moment.")
model = whisper.load_model("large")

# Check if the file exists
if not os.path.exists(audio_path):
    print(f"Error: File not found at {audio_path}")
    exit(1)

# Transcribe the audio
print(f"Transcribing {audio_path}...")
result = model.transcribe(audio_path)

# Save the transcription
output_path = "/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/transcription_output.txt"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(result["text"])

print(f"Transcription completed and saved to {output_path}")
