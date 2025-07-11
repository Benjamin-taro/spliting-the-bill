import base64, mimetypes, os
from together import Together

def to_data_uri(path: str) -> str:
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:{mime};base64,{b64}"

client = Together(api_key=os.getenv("TOGETHER_API_KEY"))

image_data = to_data_uri("IMG_0674.jpeg")

response = client.chat.completions.create(
    model="meta-llama/Llama-Vision-Free",          # ← ここを変更
    max_tokens=512,
    messages=[{
        "role": "user",
        "content": [
            {"type": "text",
             "text": "Extract all items and prices from this receipt."},
            {"type": "image_url",
             "image_url": {"url": image_data}}
        ]
    }]
)
print(response.choices[0].message.content)
