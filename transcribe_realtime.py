import whisper
import sys
import os

# Define paths
audio_path = "/Users/luizfernandotoledo/Desktop/South Way 27 (1).m4a"
log_path = "/Users/luizfernandotoledo/Desktop/transcricao_real_time.txt"
final_output_path = "/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/transcricao_final_completa.txt"

class Tee(object):
    def __init__(self, *files):
        self.files = files
    def write(self, obj):
        for f in self.files:
            f.write(obj)
            f.flush() # Force flush for real-time update
    def flush(self):
        for f in self.files:
            f.flush()

# Check file existence
if not os.path.exists(audio_path):
    print(f"Error: Audio file not found at {audio_path}")
    sys.exit(1)

print(f"Starting transcription of {audio_path} using 'large' model...")
print(f"Real-time output will be saved to: {log_path}")

try:
    # Open log file
    f = open(log_path, 'w', encoding='utf-8')
    # Backup original stdout
    original_stdout = sys.stdout
    # Redirect stdout to both terminal and file
    sys.stdout = Tee(sys.stdout, f)

    # Load model
    print("Loading model...")
    model = whisper.load_model("large")

    # Transcribe with verbose=True to print segments as they are processed
    # This output goes to stdout, which is hooked to our file
    result = model.transcribe(audio_path, verbose=True, language="pt")

    # Restore stdout
    sys.stdout = original_stdout
    f.close()

    # Save final clean text separately as well
    with open(final_output_path, "w", encoding="utf-8") as final_f:
        final_f.write(result["text"])

    print(f"\nProcessing complete!")
    print(f"Full text saved to: {final_output_path}")

except Exception as e:
    # If error, try to restore stdout to print error
    sys.stdout = sys.__stdout__
    print(f"An error occurred: {e}")
    sys.exit(1)
