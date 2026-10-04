from flask import Flask, render_template, request, jsonify, session
import os, json, uuid

app = Flask(__name__)
app.secret_key = "change-this-secret-key"

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)


def get_user_file():
    if "uid" not in session:
        session["uid"] = uuid.uuid4().hex
    return os.path.join(DATA_DIR, f"{session['uid']}.json")


def load_words():
    path = get_user_file()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def save_words(words):
    with open(get_user_file(), "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/words", methods=["GET"])
def api_get_words():
    return jsonify(load_words())


@app.route("/api/words", methods=["POST"])
def api_add_word():
    data = request.get_json(silent=True) or {}
    en = (data.get("en") or "").strip()
    fa = (data.get("fa") or "").strip()
    if not en or not fa:
        return jsonify({"error": "هر دو فیلد لازم است"}), 400
    words = load_words()
    words.append({"en": en, "fa": fa})
    save_words(words)
    return jsonify(words), 201


@app.route("/api/words/<int:index>", methods=["DELETE"])
def api_delete_word(index):
    words = load_words()
    if 0 <= index < len(words):
        words.pop(index)
        save_words(words)
    return jsonify(words)


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
