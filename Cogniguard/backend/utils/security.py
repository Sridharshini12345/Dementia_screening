import jwt
import datetime
from functools import wraps
from flask import request, jsonify, current_app
import importlib
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import base64

store_module = importlib.import_module("store")
load_store = store_module.load_store

ENCRYPTION_KEY = get_random_bytes(32)

def encrypt_data(data: str) -> str:
    cipher = AES.new(ENCRYPTION_KEY, AES.MODE_EAX)
    nonce = cipher.nonce
    ciphertext, tag = cipher.encrypt_and_digest(data.encode('utf-8'))
    return base64.b64encode(nonce + tag + ciphertext).decode('utf-8')

def decrypt_data(encrypted_data: str) -> str:
    raw_data = base64.b64decode(encrypted_data)
    nonce = raw_data[:16]
    tag = raw_data[16:32]
    ciphertext = raw_data[32:]
    cipher = AES.new(ENCRYPTION_KEY, AES.MODE_EAX, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag).decode('utf-8')

def generate_token(user):
    user_id = user.get('id') if isinstance(user, dict) else user
    role = user.get('role', 'user') if isinstance(user, dict) else 'user'
    name = user.get('name', 'User') if isinstance(user, dict) else 'User'
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1),
        'iat': datetime.datetime.utcnow(),
        'sub': user_id,
        'role': role,
        'name': name,
    }
    return jwt.encode(payload, current_app.config.get('SECRET_KEY'), algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            else:
                token = auth_header
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            store_data = load_store()
            user_obj = next((u for u in store_data.get("users", []) if u.get("id") == data['sub']), None)
            if not user_obj:
                return jsonify({'message': 'Token is invalid! User not found.'}), 401
            if user_obj.get('role') != 'admin' and user_obj.get('is_active', True) is False:
                return jsonify({'message': 'Your account is restricted by admin.'}), 403

            current_user = {
                'id': data['sub'],
                'role': data.get('role', 'user'),
                'name': data.get('name', 'User')
            }
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated
