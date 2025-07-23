import os
import csv
import io
import re
from datetime import datetime, timedelta, date, time
from functools import wraps
from math import ceil
from dateutil.relativedelta import relativedelta
from io import StringIO
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer
from calendar import monthrange
import logging

from flask import (
    Flask,
    request,
    jsonify,
    abort,
    url_for,
    current_app,
    send_from_directory,
    send_file,
    make_response,
    render_template
)
from flask_cors import CORS
from sqlalchemy.orm import joinedload
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    get_jwt,
    verify_jwt_in_request,
    jwt_required,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import or_, func, desc, asc

from models import (
    db,
    AdminUser,
    Investor,
    Investment,
    LoanApplication,
    Notification,
    AuditLog,
    LoanRepayment,
    WithdrawalRequest
)

# -------------------- App & DB Config --------------------
app = Flask(__name__)

app.logger.setLevel(logging.DEBUG)

# --- Gmail SMTP Configuration ---
app.config.update(
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv('GMAIL_USERNAME'),  # your Gmail address
    MAIL_PASSWORD=os.getenv('GMAIL_PASSWORD'),  # your Gmail App Password
    MAIL_DEFAULT_SENDER=(
        'MyApp Support',                      # display name
        os.getenv('GMAIL_USERNAME')           # sender email
    )
)

# Initialize Mail
mail = Mail(app)

# Allow CORS + credentials from your Vite dev server
CORS(
    app,
    resources={ r"/api/*": {
        "origins": ["https://localhost:5173"], 
        "supports_credentials": True
    } }
)

basedir = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config.update({
    'SQLALCHEMY_DATABASE_URI': f"sqlite:///{os.path.join(basedir, 'microfinance.db')}",
    'SQLALCHEMY_TRACK_MODIFICATIONS': False,
    'JWT_SECRET_KEY': os.environ.get('JWT_SECRET_KEY', '9b353dec2ca5d21763c7577dee8f113cc09f9234d1083e89c883447004d3b590'),
    'UPLOAD_FOLDER': UPLOAD_FOLDER,

    # ←— Store JWTs in secure cookies only
    'JWT_TOKEN_LOCATION': ['cookies'],
    'JWT_COOKIE_SECURE': True,            # only sent over HTTPS
    'JWT_COOKIE_SAMESITE': 'None',        # allow cross‑site cookie
    'JWT_COOKIE_CSRF_PROTECT': False,     # disable CSRF checks for now

    # ←— Access token cookie sent on every /api/* call
    'JWT_ACCESS_COOKIE_PATH': '/api/',

    # ←— Refresh token cookie only sent on this endpoint
    'JWT_REFRESH_COOKIE_PATH': '/api/auth/refresh',
})
serializer = URLSafeTimedSerializer(app.config['JWT_SECRET_KEY'])
CONFIRM_TOKEN_EXPIRATION = 600
PASSWORD_RESET_EXPIRATION = 600

# Initialize DB + JWT
db.init_app(app) 
jwt = JWTManager(app)

def send_email(to, subject, html_body):
    """
    Send an email.
    :param to: recipient email address (string)
    :param subject: email subject (string)
    :param html_body: HTML content for the email (string)
    """
    msg = Message(subject, recipients=[to], html=html_body)
    mail.send(msg)
# ——— Turn 422/401 errors into JSON for easier debugging ———

@jwt.expired_token_loader
def _expired_token_callback(jwt_header, jwt_payload):
    current_app.logger.warning("Expired JWT payload: %r", jwt_payload)
    return jsonify(error="Token has expired"), 401

@jwt.invalid_token_loader
def _invalid_token_callback(error_string):
    current_app.logger.warning("Invalid JWT: %s", error_string)
    return jsonify(error="Invalid token"), 422

@jwt.unauthorized_loader
def _missing_token_callback(error_string):
    current_app.logger.warning("Missing JWT: %s", error_string)
    return jsonify(error="Missing token"), 401


# -------------------- Helpers --------------------
def audit_log(actor_id, role, action, details=None):
    log = AuditLog(
        actor_id=actor_id,
        role=role,
        action=action,
        details=details,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    db.session.add(log)
    db.session.commit()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg', 'pdf'}

def is_within_window():
    today = date.today().day
    return today >= 28 or today <= 8

def calculate_interest_rate(amount, duration_months):
    brackets = [
        (28, 99, {1:8, 2:8, 3:8, 4:10, 5:10, 6:10, 7:12, 8:12, 9:12, 10:12, 11:12, 12:12}),
        (100, 199, {1:10,2:10,3:10,4:12,5:12,6:12,7:13,8:13,9:13,10:13,11:13,12:13}),
        (200, float('inf'), {1:12,2:12,3:12,4:14,5:14,6:14,7:15,8:15,9:15,10:15,11:15,12:15})
    ]
    for lo, hi, rates in brackets:
        if lo <= amount <= hi:
            return rates.get(duration_months, rates[max(rates)])
    return 0

def loan_interest_rate(amount):
    if 28 <= amount <= 99:
        return 25.0
    if 100 <= amount <= 349:
        return 20.0
    if amount >= 350:
        return 17.0
    return 0

def validate_email(email):
    pattern = r'^\S+@\S+\.\S+$'
    return re.match(pattern, email)

def calculate_expected_return(amount, duration_months):
    # Example rates - adjust to your actual rates
    if amount < 100:
        if duration_months <= 3:
            rate = 0.08
        elif duration_months <= 6:
            rate = 0.10
        else:
            rate = 0.12
    elif amount < 200:
        if duration_months <= 3:
            rate = 0.10
        elif duration_months <= 6:
            rate = 0.12
        else:
            rate = 0.13
    else:
        if duration_months <= 3:
            rate = 0.12
        elif duration_months <= 6:
            rate = 0.14
        else:
            rate = 0.15

    # Compound interest monthly
    total_return = amount * ((1 + rate) ** duration_months)
    expected_profit = total_return - amount
    return expected_profit, total_return


# -------------------- Decorators --------------------
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return jsonify(error='Admins only'), 403
        return fn(*args, **kwargs)
    return wrapper

def investor_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get('role') != 'investor':
            return jsonify(error='Investors only'), 403
        return fn(*args, **kwargs)
    return wrapper

def get_next_withdrawal_window(date):
    """
    Return the next valid withdrawal window date (28th of current or next month).
    """
    if date.day >= 28:
        next_month = (date.replace(day=1) + timedelta(days=32)).replace(day=28)
        return next_month
    elif date.day <= 8:
        return date.replace(day=28)
    else:
        return date.replace(day=28)


# -------------------- File Serving --------------------

# Serve uploaded files securely
@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_file(filename):
    uploads_dir = os.path.join(app.root_path, 'uploads')
    return send_file(os.path.join(uploads_dir, filename), as_attachment=True)

@app.route('/uploads/<path:filename>')
@admin_required
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Configure upload folder (set this somewhere in your config)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/test-email')
def test_email():
    try:
        send_email(
            to=app.config['MAIL_USERNAME'],
            subject='Test Email from Flask-Mail',
            html_body='<p>This is a <strong>test</strong> email sent via Flask-Mail!</p>'
        )
        return 'Test email sent — check your inbox!', 200
    except Exception as e:
        return f'Error sending email: {e}', 500

# -------------------- Admin Registration --------------------
@app.route('/api/admin-register', methods=['POST'])
def register_admin():
    existing = AdminUser.query.count()
    data = request.json or {}
    email = data.get('email')
    pwd = data.get('password')
    name = data.get('name')
    # First admin open; thereafter only super-admin
    if existing > 0:
        verify_jwt_in_request()
        identity = int(get_jwt_identity())
        if identity != 1:
            return jsonify(error='Only super-admin can add admins'), 403
    if not email or not pwd or not name:
        return jsonify(error='Name, email and password required'), 400
    if not validate_email(email):
        return jsonify(error='Invalid email'), 400
    if AdminUser.query.filter_by(email=email).first():
        return jsonify(error='Email exists'), 400
    admin = AdminUser(
        name=name, email=email,
        password_hash=generate_password_hash(pwd, method='pbkdf2:sha256')
    )
    db.session.add(admin)
    db.session.commit()
    audit_log(admin.id, 'admin', 'Created admin')
    return jsonify(msg='Admin created'), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email_or_username = data.get('email') or data.get('email_or_username')
    password          = data.get('password')

    if not email_or_username or not password:
        return jsonify(msg='Email (or username) and password required'), 400

    # 1) Try admin by email
    user = AdminUser.query.filter_by(email=email_or_username).first()
    role = 'admin'

    # 2) If not found, try investor by email or username
    if not user:
        user = Investor.query.filter(
            (Investor.email == email_or_username) |
            (Investor.username == email_or_username)
        ).first()
        role = 'investor'

    # 3) Validate
    if not user or not user.check_password(password):
        return jsonify(msg='Invalid credentials'), 401

    # 4) (Optional) For investors only, ensure approved
    if role == 'investor' and not getattr(user, 'is_approved', True):
        return jsonify(msg='Investor not approved'), 403

    # 5) Build identity and tokens
        # New: identity is the stringified user ID
    identity = str(user.id)

    # Put role/email into extra claims
    extra = {'role': role, 'email': user.email}

    access_token  = create_access_token(identity=identity, additional_claims=extra)
    refresh_token = create_refresh_token(identity=identity, additional_claims=extra)


    # 6) Set refresh cookie, return access token + any extra info
    resp = jsonify(
        access_token=access_token,
        full_name=getattr(user, 'name', None) or f"{getattr(user, 'first_name','')} {getattr(user,'surname','')}".strip()
    )
    set_access_cookies(resp, access_token) 
    set_refresh_cookies(resp, refresh_token)
    return resp, 200

@app.route('/api/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    identity = get_jwt_identity()
    new_access = create_access_token(identity=identity)
    return jsonify(access_token=new_access), 200

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    resp = jsonify({'msg': 'Logout successful'})
    unset_jwt_cookies(resp)
    return resp, 200

# Example protected route
@app.route('/api/protected', methods=['GET'])
@jwt_required()
def protected():
    return jsonify({'user': get_jwt_identity()}), 200

# ------------------ Super-Admin Management Endpoints ------------------

# 1) List all admins
@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
def list_admins():
    # only super-admin (id==1) can list
    verify_jwt_in_request()
    if int(get_jwt_identity()) != 1:
        return jsonify(error='Only super-admin can list admins'), 403

    users = AdminUser.query.order_by(AdminUser.id).all()
    return jsonify(users=[{
        'id': u.id,
        'name': u.name,
        'email': u.email
    } for u in users]), 200

# 2) Delete an admin by ID
@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_admin(user_id):
    verify_jwt_in_request()
    if int(get_jwt_identity()) != 1:
        return jsonify(error='Only super-admin can delete admins'), 403
    if user_id == 1:
        return jsonify(error="Can't delete super-admin"), 400

    user = AdminUser.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f'Deleted admin {user_id}')
    return jsonify(msg='Admin deleted'), 200

# 3) Change an admin’s password
@app.route('/api/admin/users/<int:user_id>/password', methods=['PUT'])
@jwt_required()
def change_admin_password(user_id):
    verify_jwt_in_request()
    current_id = int(get_jwt_identity())
    # only super-admin or the admin themselves
    if current_id != 1 and current_id != user_id:
        return jsonify(error='Not authorized to change this password'), 403

    data = request.get_json() or {}
    new_pwd = data.get('password')
    if not new_pwd:
        return jsonify(error='Password is required'), 400

    user = AdminUser.query.get_or_404(user_id)
    user.password_hash = generate_password_hash(new_pwd, method='pbkdf2:sha256')
    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f'Changed password for admin {user_id}')
    return jsonify(msg='Password updated'), 200

# -------------------- Investor Registration --------------------
@app.route('/api/investor-register', methods=['POST'])
def register_investor():
    data = request.form

    # 1) Extract required fields
    full_name    = data.get('full_name')
    username     = data.get('username')
    email        = data.get('email')
    password     = data.get('password')
    phone        = data.get('phone')
    id_number    = data.get('id_number')
    address      = data.get('address')
    next_of_kin  = data.get('next_of_kin')
    phone_of_kin = data.get('phone_of_kin')

    # 2) Check required fields
    if not (full_name and username and email and password and phone and id_number):
        return jsonify({'message': 'Missing required fields'}), 400

    # 3) Split name
    parts = full_name.strip().split()
    if len(parts) < 2:
        return jsonify({'message': 'Please provide both first name and surname'}), 400
    first_name, surname = parts[0], ' '.join(parts[1:])

    # 4) Validate phone & ID formats
    phone_re = r'^\+263\d{9}$'
    if not re.match(phone_re, phone) or (phone_of_kin and not re.match(phone_re, phone_of_kin)):
        return jsonify({'message': 'Invalid phone format. Example: +263780000000'}), 400
    id_re = r'^75-\d{6,7}[A-Z]75$'
    if not re.match(id_re, id_number):
        return jsonify({'message': 'Invalid ID format. Example: 75-0000000X75'}), 400

    # 5) Ensure files present
    proof_res  = request.files.get('proof_of_residence')
    id_doc     = request.files.get('id_document')
    face_photo = request.files.get('face_photo')
    if not (proof_res and id_doc and face_photo):
        return jsonify({'message': 'All three files are required'}), 400

    # 6) Save uploaded files
    base = app.config['UPLOAD_FOLDER']
    dirs = {
      'res': os.path.join(base, 'investors/residence_proofs'),
      'id':  os.path.join(base, 'investors/id_photos'),
      'face':os.path.join(base, 'investors/face_photos')
    }
    for path in dirs.values():
        os.makedirs(path, exist_ok=True)

    res_fn  = secure_filename(proof_res.filename)
    id_fn   = secure_filename(id_doc.filename)
    face_fn = secure_filename(face_photo.filename)

    proof_res.save(os.path.join(dirs['res'], res_fn))
    id_doc.save   (os.path.join(dirs['id'],  id_fn))
    face_photo.save(os.path.join(dirs['face'],face_fn))

    # 7) Check for existing investor
    existing = Investor.query.filter(
        (Investor.email==email)|(Investor.username==username)
    ).first()
    if existing:
        if existing.is_rejected:
            # your re-application reset logic here...
            db.session.commit()
            return jsonify({'message': 'Re-application submitted. Awaiting Admin Approval.'}), 200
        return jsonify({'message': 'Username or email already exists'}), 400

    # 8) Create new investor (including email-confirm flag)
    new_inv = Investor(
        first_name=first_name,
        surname=surname,
        username=username,
        email=email,
        password_hash=generate_password_hash(password, method='pbkdf2:sha256'),
        phone=phone,
        id_number=id_number,
        address=address,
        next_of_kin=next_of_kin,
        phone_of_kin=phone_of_kin,
        proof_of_residence=res_fn,
        id_document=id_fn,
        face_photo=face_fn,
        is_approved=False,
        is_rejected=False,
        is_confirmed=False
    )
    db.session.add(new_inv)
    db.session.commit()

    # 9) Generate token & send confirmation email
    token       = serializer.dumps(new_inv.email, salt='email-confirm')
    confirm_url = url_for('confirm_investor_email', token=token, _external=True)
    html = render_template('activate.html', confirm_url=confirm_url, new_investor=new_inv)

    send_email(
        to=new_inv.email,
        subject='Please confirm your AC Finance account',
        html_body=html
    )

    # --- Notify all admins of the new registration ---
    admins = AdminUser.query.all()
    admin_emails = [a.email for a in admins]
    admin_link = f"{request.host_url.rstrip('/')}/admin/pending-investors"
    admin_html = render_template(
        'admin_new_registration.html',
        investor=new_inv,
        admin_link=admin_link
    )
    msg = Message(
        subject="🚀 New Investor Registration on AC Finance",
        recipients=admin_emails,
        html=admin_html
    )
    mail.send(msg)

    return jsonify({
        'message': 'Investor registration request successful. '
                   'Please check your email to confirm before logging in.'
    }), 201

# -------------------- Investment Submission --------------------
@app.route('/api/investor/invest', methods=['POST'])
@investor_required
def submit_investment():
    form = request.form
    files = request.files
    amt = form.get('amount')
    dur = form.get('duration_months')

    if not amt or not dur or 'proof' not in files:
        return jsonify(error='Amount, duration and proof required'), 400

    try:
        amt = float(amt)
        dur = int(dur)
    except:
        return jsonify(error='Invalid values'), 400

    if amt <= 0 or dur <= 0:
        return jsonify(error='Must be positive'), 400

    if not allowed_file(files['proof'].filename):
        return jsonify(error='Invalid proof file'), 400


    # Save proof file with unique timestamp prefix
    f = files['proof']
    fname = f"proof_{int(datetime.utcnow().timestamp())}_{secure_filename(f.filename)}"
    proof_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'investments', 'proofs_of_payment')
    os.makedirs(proof_folder, exist_ok=True)
    f.save(os.path.join(proof_folder, fname))

    inv_id = int(get_jwt_identity())
    rate = calculate_interest_rate(amt, dur)

    investment = Investment(
        investor_id=inv_id,
        amount=amt,
        duration_months=dur,
        rate=rate,
        proof_of_payment=fname,
        status='pending',
        created_at=datetime.utcnow()
    )
    db.session.add(investment)
    db.session.commit()

    audit_log(inv_id, 'investor', f'Submitted investment {investment.id}')
    return jsonify(msg='Investment submitted', rate=rate), 201

# -------------------- Investor Investment History --------------------
@app.route('/api/investor/investments', methods=['GET'])
@investor_required
def investor_investment_history():
    inv_id = int(get_jwt_identity())
    today = datetime.utcnow()

    # Query params
    status_filter = request.args.get('status')
    expected_month_filter = request.args.get('expected_withdrawal_date')  # format: YYYY-MM
    ready_withdrawal_filter = request.args.get('ready_for_withdrawal', '').lower() == 'true'
    sort_by = request.args.get('sort_by', 'created_at')
    order = request.args.get('order', 'desc')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))

    # Base query
    query = Investment.query.filter_by(investor_id=inv_id)
    if status_filter:
        query = query.filter_by(status=status_filter)

    # Sorting
    if sort_by in ['amount', 'rate', 'created_at']:
        col = getattr(Investment, sort_by)
        query = query.order_by(col.desc() if order == 'desc' else col.asc())
    else:
        query = query.order_by(Investment.created_at.desc())

    # Pagination
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    investments = paginated.items

    def in_withdrawal_window(dt):
        return dt.day >= 28 or dt.day <= 8

    result = []
    for inv in investments:
        # When the investment actually started
        start = inv.approved_at or inv.created_at

        # Expected withdrawal = start + duration_months
        expected_dt = (start + relativedelta(months=+inv.duration_months)).replace(
            hour=0, minute=0, second=0, microsecond=0)

        # Can only request withdrawal if:
        #  1. status is 'approved'
        #  2. today >= expected_dt
        #  3. we're in the 28th–8th withdrawal window
        can_withdraw_now = (
            inv.status == 'approved' and
            today.date() >= expected_dt.date() and
            in_withdrawal_window(today)
        )

        # Filters
        if expected_month_filter and expected_dt.strftime('%Y-%m') != expected_month_filter:
            continue
        if ready_withdrawal_filter and not can_withdraw_now:
            continue

        result.append({
            'id': inv.id,
            'amount': inv.amount,
            'rate': inv.rate,
            'duration_months': inv.duration_months,
            'status': inv.status,
            'is_approved': (inv.status == 'approved'),
            'created_at': inv.created_at.strftime('%Y-%m-%d'),
            'expected_return': round(inv.projected_value(), 2),
            'expected_withdrawal_date': expected_dt.strftime('%Y-%m-%d'),
            'can_withdraw_now': can_withdraw_now,
            'proof_of_payment': inv.proof_of_payment,
            # infer withdrawal_requested from status
            'withdrawal_requested': (inv.status == 'withdrawal_requested'),
            # Uncomment if your model supports these fields
            # 'withdrawal_paid': inv.withdrawal_paid,
            # 'withdrawal_payment_proof': inv.withdrawal_payment_proof,
        })

    return jsonify({
        'investments': result,
        'pagination': {
            'page': paginated.page,
            'per_page': paginated.per_page,
            'total_pages': paginated.pages,
            'total_items': paginated.total
        }
    }), 200

# -------------------- Investment Withdrawal Request --------------------
@app.route('/api/investor/request-withdrawal/<int:investment_id>', methods=['POST'])
@investor_required
def request_withdrawal(investment_id):
    if not is_within_window():
        return jsonify(error='Withdrawals only allowed from 28th to 8th'), 400

    investment = db.session.get(Investment, investment_id)
    if investment is None:
        abort(404)

    # Remove the is_approved check—just check status
    if investment.status != 'approved':
        return jsonify(error='Only approved investments can be withdrawn'), 400

    # Prevent duplicate pending requests
    if WithdrawalRequest.query.filter_by(investment_id=investment_id, status='pending').first():
        return jsonify(error='You already requested a withdrawal for this investment'), 400

    investor_id = get_jwt_identity()

    withdrawal = WithdrawalRequest(
        investment_id=investment.id,
        investor_id=investor_id,
        amount=investment.amount,
        status='pending',
        created_at=datetime.utcnow()
    )
    investment.status = 'withdrawal_requested'
    db.session.add(withdrawal)
    db.session.commit()
    audit_log(investor_id, 'investor', f'Requested withdrawal for investment {investment_id}')
    return jsonify(msg='Withdrawal requested'), 200


@app.route('/api/investor/withdrawal-proof/<filename>', methods=['GET'])
@investor_required
def serve_withdrawal_proof(filename):
    """
    Serves the admin-uploaded proof of payment for a withdrawal.
    Investor uses this URL to view the proof before confirming.
    """
    # withdrawal proofs are stored in UPLOAD_FOLDER/withdrawals
    proofs_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'withdrawals')
    # Ensure the investor only accesses their own proofs:
    #   lookup the WithdrawalRequest record, check jwt_identity matches
    wr = WithdrawalRequest.query.filter_by(proof_of_payment=filename).first_or_404()
    if wr.investor_id != int(get_jwt_identity()):
        return jsonify(error='Unauthorized'), 403

    return send_from_directory(proofs_dir, filename, as_attachment=False)


@app.route('/api/investor/confirm-withdrawal/<int:withdrawal_id>', methods=['POST'])
@investor_required
def confirm_withdrawal(withdrawal_id):
    investor_id = get_jwt_identity()

    withdrawal = WithdrawalRequest.query.filter_by(id=withdrawal_id, investor_id=investor_id).first_or_404()

    if withdrawal.status != 'paid':
        return jsonify(error='This withdrawal is not marked as paid yet'), 400

    withdrawal.status = 'completed'
    db.session.commit()

    audit_log(investor_id, 'investor', f'Confirmed withdrawal receipt for withdrawal {withdrawal_id}')
    return jsonify(msg='Withdrawal confirmed, marked as completed')


# -------------------- Admin: Get Withdrawals --------------------
@app.route('/api/admin/withdrawals', methods=['GET'])
@admin_required
def get_withdrawals():
    # query args
    status = request.args.get('status')
    page   = int(request.args.get('page', 1))
    per_page = 20

    # base query, ordered newest first
    qry = db.session.query(WithdrawalRequest) \
        .order_by(WithdrawalRequest.created_at.desc())

    if status:
        qry = qry.filter(WithdrawalRequest.status == status)

    # eager‑load each withdrawal’s investment → investor
    qry = qry.options(
        joinedload(WithdrawalRequest.investment)
            .joinedload(Investment.investor)
    )

    # paginate
    pagination = qry.paginate(page=page, per_page=per_page, error_out=False)
    withdrawals = pagination.items

    results = []
    for w in withdrawals:
        inv = w.investment
        investor = inv.investor

        # build full name (first_name + surname)
        investor_name = f"{investor.first_name} {investor.surname}"

        # calculate expected withdrawal amount if not stored
        if getattr(inv, 'expected_withdrawal_amount', None) is not None:
            expected = inv.expected_withdrawal_amount
        else:
            principal = inv.amount
            rate      = inv.rate / 100.0
            months    = inv.duration_months
            expected  = round(principal * ((1 + rate) ** months), 2)

        results.append({
            "id": w.id,
            "investment_id": inv.id,
            "investor_id": investor.id,
            "investor_name": investor_name,
            "amount": float(w.amount),
            "expected_withdrawal_amount": expected,
            "date_requested": w.created_at.strftime('%Y-%m-%d %H:%M:%S') if w.created_at else None,
            "status": w.status
        })

    return jsonify({
        "withdrawals": results,
        "total_pages": pagination.pages
    })

# -------------------- Admin: Approve Withdrawal --------------------
@app.route('/api/admin/withdrawals/<int:withdrawal_id>/approve', methods=['POST'])
@admin_required
def approve_withdrawal(withdrawal_id):
    withdrawal = WithdrawalRequest.query.get_or_404(withdrawal_id)

    if withdrawal.status != 'pending':
        return jsonify(error='Withdrawal already processed'), 400

    proof = request.files.get('proof_of_payment')
    if not proof:
        return jsonify(error='Proof of payment file is required'), 400

    filename = secure_filename(f"withdrawal_proof_{withdrawal.id}_{proof.filename}")
    proof_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'withdrawals')
    os.makedirs(proof_folder, exist_ok=True)
    filepath = os.path.join(proof_folder, filename)
    proof.save(filepath)

    withdrawal.status = 'paid'
    withdrawal.proof_of_payment = filename
    withdrawal.date_approved = datetime.utcnow()  # if your model supports it

    investment = db.session.get(Investment, withdrawal.investment_id)
    if investment:
        investment.status = 'withdrawn'
        investment.withdrawal_paid = True
        investment.withdrawal_payment_proof = filename
        investment.withdrawal_date = datetime.utcnow()

    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f'Approved withdrawal {withdrawal_id}')
    return jsonify(msg='Withdrawal approved and marked paid')


# -------------------- Admin: Reject Withdrawal --------------------
@app.route('/api/admin/withdrawals/<int:withdrawal_id>/reject', methods=['POST'])
@admin_required
def reject_withdrawal(withdrawal_id):
    withdrawal = WithdrawalRequest.query.get_or_404(withdrawal_id)
    if withdrawal.status != 'pending':
        return jsonify(error='Withdrawal already processed'), 400

    withdrawal.status = 'rejected'
    investment = Investment.query.get(withdrawal.investment_id)
    if investment:
        investment.status = 'approved'

    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f'Rejected withdrawal {withdrawal_id}')
    return jsonify(msg='Withdrawal rejected')


# -------------------- Investor: Get Withdrawals --------------------
@app.route('/api/investor/withdrawals', methods=['GET'])
@investor_required
def investor_withdrawals():
    investor_id = int(get_jwt_identity())
    # Pull all withdrawals for this investor, newest first
    withdrawals = (
        db.session.query(WithdrawalRequest)
        .join(Investment, WithdrawalRequest.investment_id == Investment.id)
        .filter(WithdrawalRequest.investor_id == investor_id)
        .order_by(WithdrawalRequest.created_at.desc())
        .all()
    )

    result = []
    for w in withdrawals:
        inv = db.session.get(Investment, w.investment_id)
        # Compute expected withdrawal amount if not stored on Investment
        if getattr(inv, 'expected_withdrawal_amount', None) is not None:
            expected = inv.expected_withdrawal_amount
        else:
            p = inv.amount
            r = inv.rate / 100.0
            n = inv.duration_months
            expected = round(p * ((1 + r) ** n), 2)

        result.append({
            'id': w.id,
            'investment_id': w.investment_id,
            'amount': float(w.amount),
            'expected_withdrawal_amount': expected,
            'status': w.status,
            'date_requested': w.created_at.strftime('%Y-%m-%d %H:%M:%S') if w.created_at else None,
            'proof_of_payment': w.proof_of_payment
        })

    return jsonify(result)

# -------------------- Investor Loan Application --------------------
@app.route('/api/investor/loan-applications', methods=['POST'])
@jwt_required()
def submit_loan_application():
    current_investor_id = get_jwt_identity()

    data = request.get_json()
    amount = data.get('amount')
    purpose = data.get('purpose')

    if not amount or amount <= 0:
        return jsonify({"msg": "Invalid loan amount"}), 400

    # Fetch investor details for full_name, email, phone
    investor = Investor.query.get(current_investor_id)
    if not investor:
        return jsonify({"msg": "Investor not found"}), 404

    loan = LoanApplication(
        investor_id=current_investor_id,
        full_name=f"{investor.first_name} {investor.surname}",
        email=investor.email,
        phone=investor.phone,
        amount=amount,
        purpose=purpose,
        status='pending',
        submitted_at=datetime.utcnow()
    )

    # Assign interest rate based on amount
    loan.assign_interest_rate()

    # Set repayment due date to None (to be set later)
    loan.repayment_due_date = None

    db.session.add(loan)
    db.session.commit()

    return jsonify({
        "loan_id": loan.id,
        "status": loan.status,
        "instruction": "Please visit our office for verification"
    }), 201


# -------------------- Admin Approve Investment --------------------
@app.route('/api/admin/approve-investment/<int:investment_id>', methods=['PUT'])
@admin_required
def approve_investment(investment_id):
    investment = db.session.get(Investment, investment_id)
    if investment is None:
        abort(404)
    if investment.status != 'pending':
        return jsonify(error='Investment not pending approval'), 400
    investment.status = 'approved'
    investment.approved_at = datetime.utcnow()
    investment.is_authorized = True
    db.session.commit()
    notif = Notification(investor_id=investment.investor_id, message=f'Investment {investment_id} approved')
    db.session.add(notif)
    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f'Approved investment {investment_id}')
    return jsonify(msg='Investment approved'), 200

# -------------------- Super‑Admin Re‑Approve Investment --------------------
@app.route('/api/admin/reapprove-investment/<int:investment_id>', methods=['PUT'])
@admin_required
def reapprove_investment(investment_id):
    # Only super‑admin (JWT identity “1”) can re‑approve rejected investments
    identity = int(get_jwt_identity())
    if identity != 1:
        return jsonify(error='Only super‑admin may re‑approve rejected investments'), 403

    # Fetch and verify status
    investment = db.session.get(Investment, investment_id)
    if investment is None:
         abort(404)
    if investment.status != 'rejected':
        return jsonify(error='Investment not in rejected status'), 400

    # Re‑approve
    investment.status = 'approved'
    investment.is_authorized = True
    db.session.commit()

    # Notify investor
    notif = Notification(
        investor_id=investment.investor_id,
        message=f'Your investment #{investment_id} has been approved by super‑admin'
    )
    db.session.add(notif)
    db.session.commit()

    # Audit log
    audit_log(
        actor_id=identity,
        role='admin',
        action=f'Super‑admin re‑approved investment {investment_id}'
    )

    return jsonify(msg='Investment re‑approved'), 200

# -------------------- Admin View Pending Investments --------------------
@app.route('/api/admin/pending-investments', methods=['GET'])
@jwt_required()  # or @admin_required if you have that decorator
def view_pending_investments():
    current_user = get_jwt_identity()

    # 1. Params
    page   = request.args.get('page', default=1, type=int) or 1
    search = (request.args.get('search', default="", type=str) or "").strip()

    # 2. Base query
    query = Investment.query.filter_by(status='pending')

    # 3. Optional search across investor fields
    if search:
        pattern = f"%{search}%"
        query = query.join(Investor).filter(
            db.or_(
                Investor.first_name.ilike(pattern),
                Investor.surname.ilike(pattern),
                Investor.username.ilike(pattern),
                Investor.email.ilike(pattern),
            )
        )

    # 4. Pagination
    per_page     = 10
    total_count  = query.count()
    total_pages  = ceil(total_count / per_page)
    items        = (
        query
        .order_by(Investment.id)
        .paginate(page=page, per_page=per_page, error_out=False)
        .items
    )

    # 5. Build response
    results = []
    for inv in items:
        investor = Investor.query.get(inv.investor_id)
        results.append({
            'id':               inv.id,
            'amount':           inv.amount,
            'duration_months':  inv.duration_months,
            'rate':             inv.rate,
            'proof_of_payment': inv.proof_of_payment,
            'investor_name':    f"{investor.first_name} {investor.surname}" if investor else 'Unknown',
            'submitted_on':     inv.created_at.strftime('%Y-%m-%d') if inv.created_at else None,
        })

    return jsonify({
        'pending_investments':  results,
        'total_pages': total_pages
    }), 200

# -------------------- Admin Reject Investment --------------------
@app.route('/api/admin/reject-investment/<int:investment_id>', methods=['PUT'])
@admin_required
def reject_investment(investment_id):
    investment = db.session.get(Investment, investment_id)
    if investment is None:
        abort(404)
    if investment.status != 'pending':
        return jsonify(error='Investment not pending approval'), 400
    investment.status = 'rejected'
    db.session.commit()
    notif = Notification(investor_id=investment.investor_id, message=f'Investment {investment_id} rejected')
    db.session.add(notif)
    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f'Rejected investment {investment_id}')
    return jsonify(msg='Investment rejected'), 200


@app.route('/api/admin-investments', methods=['GET'])
@admin_required
def view_all_investments():
    status_filter = request.args.get('status')
    sort_by       = request.args.get('sort_by', 'created_at')
    order         = request.args.get('order', 'desc')

    query = Investment.query
    if status_filter:
        query = query.filter_by(status=status_filter)

    # Ordering is handled in Python below to support custom keys
    investments = query.all()

    result = []
    for inv in investments:
        investor = db.session.get(Investor, inv.investor_id)

        raw_maturity = inv.created_at + timedelta(days=30 * inv.duration_months)
        expected_withdrawal_date = get_next_withdrawal_window(raw_maturity)

        # Auto‑fill withdrawal_date when approved
        if inv.status == 'approved' and not inv.expected_withdrawal_date:
            inv.withdrawal_date = expected_withdrawal_date
            db.session.commit()

        expected_amount = round(
            inv.amount * ((1 + inv.rate / 100) ** inv.duration_months),
            2
        )

        result.append({
            'id': inv.id,
            'amount': inv.amount,
            'duration_months': inv.duration_months,
            'rate': inv.rate,
            'status': inv.status,
            'proof_of_payment': inv.proof_of_payment,
            'investor_name': f"{investor.first_name} {investor.surname}" if investor else 'Unknown',
            'investor_phone': investor.phone if investor else '',
            'created_at': inv.created_at.strftime('%Y-%m-%d'),
            'expected_withdrawal_date': expected_withdrawal_date.strftime('%Y-%m-%d'),
            'expected_withdrawal_amount': expected_amount
        })

    # Sort the list according to the query params
    if sort_by == 'expected_withdrawal_amount':
        result.sort(key=lambda x: x['expected_withdrawal_amount'], reverse=(order == 'desc'))
    elif sort_by == 'expected_withdrawal_date':
        result.sort(key=lambda x: x['expected_withdrawal_date'], reverse=(order == 'desc'))
    else:
        result.sort(key=lambda x: x['created_at'], reverse=(order == 'desc'))

    return jsonify(investments=result), 200

# -------------------- Admin Approve Loan --------------------
@app.route('/api/admin/approve-loan/<int:loan_id>', methods=['PUT'])
@jwt_required()
@admin_required
def approve_loan(loan_id):
    if not is_within_window():
        return jsonify(error='Loan approvals only allowed from 28th to 8th'), 400
    loan = LoanApplication.query.get_or_404(loan_id)
    if loan.status != 'pending':
        return jsonify(error='Loan not pending approval'), 400

    loan.status = 'approved'
    loan.approved_at = datetime.utcnow()
    # Auto-calculate repayment due date (30 days ahead)
    loan.repayment_due_date = loan.approved_at + timedelta(days=30)

    db.session.commit()
    notif = Notification(investor_id=loan.investor_id, message=f'Loan {loan_id} approved')
    db.session.add(notif)
    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f'Approved loan {loan_id}')
    return jsonify(msg='Loan approved'), 200



# -------------------- Admin Reject Loan --------------------
@app.route('/api/admin/reject-loan/<int:loan_id>', methods=['PUT'])
@admin_required
def reject_loan(loan_id):
    loan = LoanApplication.query.get_or_404(loan_id)
    if loan.status != 'pending':
        return jsonify(error='Loan not pending approval'), 400
    loan.status = 'rejected'
    db.session.commit()
    notif = Notification(investor_id=loan.investor_id, message=f'Loan {loan_id} rejected')
    db.session.add(notif)
    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f'Rejected loan {loan_id}')
    return jsonify(msg='Loan rejected'), 200

# -------------------- Admin List of Pending Investors --------------------
@app.route('/api/admin/pending-investors', methods=['GET'])
@admin_required
def get_pending_investors():
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', "", type=str).strip()

    # Only those that are not approved and not rejected
    query = Investor.query.filter(
        Investor.is_confirmed.is_(True),
        Investor.is_approved.is_(False),
        Investor.is_rejected.is_(False)
    )

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                Investor.first_name.ilike(pattern),
                Investor.surname.ilike(pattern),
                Investor.username.ilike(pattern),
                Investor.email.ilike(pattern),
            )
        )

    paginated   = query.order_by(Investor.id)\
                       .paginate(page=page, per_page=10, error_out=False)
    total_pages = paginated.pages

    results = [ inv.to_dict() for inv in paginated.items ]

    return jsonify({
        'investors':    results,
        'total_pages':  total_pages
    }), 200

# -------------------- Admin Approve Investor --------------------
@app.route('/api/admin/approve-investor/<int:investor_id>', methods=['PUT'])
@admin_required
def approve_investor(investor_id):
    investor = Investor.query.get_or_404(investor_id)
    if investor.is_approved:
        return jsonify(error='Investor already approved'), 400

    investor.is_approved = True
    db.session.commit()

    # record in-app notification
    notif = Notification(investor_id=investor.id,
                         message='Your investor account has been approved')
    db.session.add(notif)
    db.session.commit()

    audit_log(get_jwt_identity(), 'admin', f'Approved investor {investor_id}')

    # send approval email
    login_link = f"{request.host_url.rstrip('/')}/login"
    html = render_template(
        'investor_approved.html',
        investor=investor,
        login_link=login_link
    )
    send_email(
        to=investor.email,
        subject='Your AC Finance account is approved!',
        html_body=html
    )

    return jsonify(msg='Investor approved and notified'), 200


# -------------------- Admin: Get full Investor details --------------------
@app.route('/api/admin/investors/<int:investor_id>', methods=['GET'])
@jwt_required()
@admin_required
def get_investor_details(investor_id):
    investor = Investor.query.get_or_404(investor_id)

    # Base dict from your model
    inv_data = investor.to_dict()

    # Add loans & investments arrays
    inv_data['investments'] = [
        {
            "id": inv.id,
            "amount": inv.amount,
            "status": inv.status,
            "started_at": inv.started_at.isoformat() if getattr(inv, 'started_at', None) else None
        }
        for inv in investor.investments
    ]
    inv_data['loans'] = [
        {
            "id": loan.id,
            "amount": loan.amount,
            "status": loan.status,
            "approved_at": loan.approved_at.isoformat() if getattr(loan, 'approved_at', None) else None
        }
        for loan in investor.loans
    ]

    return jsonify(inv_data)

# -------------------- Admin: List Active Investors --------------------
@app.route('/api/admin/active-investors', methods=['GET'])
@jwt_required()
@admin_required
def list_active_investors():
    page      = int(request.args.get('page', 1))
    search    = request.args.get('search', '').strip()
    per_page  = 10  # or whatever your default is

    query = Investor.query.filter_by(is_approved=True)
    if search:
        query = query.filter(
            or_(
                Investor.first_name.ilike(f"%{search}%"),
                Investor.surname.ilike(f"%{search}%"),
                Investor.email.ilike(f"%{search}%")
            )
        )

    pagination = query.order_by(Investor.created_at.desc())\
                      .paginate(page=page, per_page=per_page, error_out=False)

    investors = [inv.to_dict() for inv in pagination.items]
    return jsonify({
        "investors": investors,
        "page":      pagination.page,
        "total_pages": pagination.pages
    })


# -------------------- Admin: List Rejected Investors --------------------
@app.route('/api/admin/rejected-investors', methods=['GET'])
@jwt_required()
@admin_required
def list_rejected_investors():
    page      = int(request.args.get('page', 1))
    search    = request.args.get('search', '').strip()
    per_page  = 10

    query = Investor.query.filter_by(is_rejected=True)
    if search:
        query = query.filter(
            or_(
                Investor.first_name.ilike(f"%{search}%"),
                Investor.surname.ilike(f"%{search}%"),
                Investor.email.ilike(f"%{search}%")
            )
        )

    pagination = query.order_by(Investor.created_at.desc())\
                      .paginate(page=page, per_page=per_page, error_out=False)

    investors = [inv.to_dict() for inv in pagination.items]
    return jsonify({
        "investors": investors,
        "page":      pagination.page,
        "total_pages": pagination.pages
    })

# Investor file download endpoint
@app.route('/api/admin/investors/<int:investor_id>/<string:field>', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_investor_file(investor_id, field):
    if request.method == 'OPTIONS':
        return '', 200

    # 1) Map field → model property + subfolder
    mapping = {
        'face_photo':      ('face_photo',      'face_photos'),
        'id_document':     ('id_document',     'id_photos'),
        'proof_of_residence': ('proof_of_residence', 'residence_proofs')
    }
    if field not in mapping:
        return jsonify(error="Invalid file type"), 400

    prop_name, subfolder = mapping[field]

    # 2) Lookup investor and filename
    investor = Investor.query.get(investor_id)
    if not investor:
        return jsonify(error="Investor not found"), 404

    filename = getattr(investor, prop_name)
    if not filename:
        return jsonify(error="No file recorded"), 404

    # 3) Build the actual disk path
    uploads_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'investors', subfolder)
    file_path = os.path.join(uploads_folder, filename)
    if not os.path.exists(file_path):
        return jsonify(error="File missing on server"), 404

    # 4) Serve with CORS headers
    response = send_from_directory(uploads_folder, filename)
    response.headers.add('Access-Control-Allow-Origin',  'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Authorization')
    return response


# Investment proof download endpoint
@app.route('/api/admin/investments/<int:investment_id>/proof_of_payment', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_investment_proof(investment_id):
    # 1) Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 200

    # 2) Fetch investment from DB
    investment = db.session.get(Investment, investment_id)
    if not investment:
        return jsonify({"error": "Investment not found"}), 404

    filename = investment.proof_of_payment
    if not filename:
        return jsonify({"error": "File not found"}), 404

    # 3) Serve the file
    uploads_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'investments', 'proofs_of_payment')
    response = send_from_directory(uploads_folder, filename)

    # 4) Add CORS headers
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Authorization')

    return response

# -------------------- Admin Reject Investor --------------------
@app.route('/api/admin/reject-investor/<int:investor_id>', methods=['PUT'])
@admin_required
def reject_investor(investor_id):
    inv = Investor.query.get_or_404(investor_id)

    if inv.is_approved:
        return jsonify(error='Investor already approved'), 400

    # Mark as rejected (not just “not approved”)
    inv.is_rejected = True
    db.session.commit()

    notif = Notification(
        investor_id=inv.id,
        message='Your investor account has been rejected'
    )
    db.session.add(notif)
    db.session.commit()

    audit_log(get_jwt_identity(), 'admin', f'Rejected investor {investor_id}')
     # send rejection email
    register_link = f"{request.host_url.rstrip('/')}/register"
    html = render_template(
        'investor_rejected.html',
        investor=inv,
        register_link=register_link
    )
    send_email(
        to=inv.email,
        subject='Your AC Finance application status',
        html_body=html
    )

    return jsonify(msg='Investor rejected and notified'), 200


# -------------------- View Loans with Filtering and Pagination --------------------
@app.route('/api/admin/loans', methods=['GET'])
@jwt_required()
@admin_required
def view_loans():
    status = request.args.get('status')
    investor_id = request.args.get('investor_id', type=int)
    min_amount = request.args.get('min_amount', type=float)
    max_amount = request.args.get('max_amount', type=float)
    start_date = request.args.get('start_date')  # YYYY-MM-DD
    end_date = request.args.get('end_date')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    query = LoanApplication.query
    if status:
        query = query.filter_by(status=status)
    if investor_id:
        query = query.filter_by(investor_id=investor_id)
    if min_amount is not None:
        query = query.filter(LoanApplication.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(LoanApplication.amount <= max_amount)
    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(LoanApplication.submitted_at >= start)
        except ValueError:
            return jsonify({'error': 'Invalid start_date format'}), 400
    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d')
            query = query.filter(LoanApplication.submitted_at <= end)
        except ValueError:
            return jsonify({'error': 'Invalid end_date format'}), 400

    paginated = query.order_by(LoanApplication.submitted_at.desc()) \
                     .paginate(page=page, per_page=per_page, error_out=False)
    loans = paginated.items

    result = []
    for loan in loans:
        investor = Investor.query.get(loan.investor_id)
        result.append({
            'loan_id': loan.id,
            'investor_id': loan.investor_id,
            'investor_name': f"{investor.first_name} {investor.surname}" if investor else 'Unknown',
            'amount': loan.amount,
            'status': loan.status,
            'interest_rate': loan.interest_rate,
            'submitted_at': loan.submitted_at.isoformat(),
            'approved_at': loan.approved_at.isoformat() if loan.approved_at else None,
            'repayment_due_date': loan.repayment_due_date.isoformat() if loan.repayment_due_date else None,
            'collateral': loan.collateral,
            'next_of_kin_details': loan.next_of_kin_details,
            'other_details': loan.other_details
        })

    return jsonify({
        'page': paginated.page,
        'per_page': paginated.per_page,
        'total': paginated.total,
        'pages': paginated.pages,
        'loans': result
    }), 200


# -------------------- Export Loans CSV --------------------
@app.route('/api/admin/loans/export', methods=['GET'])
@jwt_required()
@admin_required
def export_loans_csv():
    loans = LoanApplication.query.all()

    output = io.BytesIO()
    writer = csv.writer(io.TextIOWrapper(output, encoding='utf-8', newline=''))

    writer.writerow(['Loan ID', 'Investor ID', 'Full Name', 'Email', 'Amount', 'Status', 'Submitted At'])

    for loan in loans:
        writer.writerow([
            loan.id,
            loan.investor_id,
            loan.full_name,
            loan.email,
            loan.amount,
            loan.status,
            loan.submitted_at.isoformat()
        ])

    output.seek(0)

    return send_file(
        output,
        mimetype='text/csv',
        as_attachment=True,
        download_name='loans_export.csv'
    )

# -------------------- View loan details --------------------
@app.route('/api/admin/loans/<int:loan_id>', methods=['GET'])
@jwt_required()
@admin_required
def loan_details(loan_id):
    loan = LoanApplication.query.get_or_404(loan_id)
    investor = Investor.query.get(loan.investor_id)
    repayments = LoanRepayment.query.filter_by(loan_id=loan_id).order_by(LoanRepayment.date_paid.desc()).all()

    return jsonify({
        'loan': {
            'loan_id': loan.id,
            'amount': loan.amount,
            'status': loan.status,
            'interest_rate': loan.interest_rate,
            'repayment_due_date': loan.repayment_due_date.isoformat() if loan.repayment_due_date else None,
            'submitted_at': loan.submitted_at.isoformat(),
            'collateral': loan.collateral,
            'next_of_kin_details': loan.next_of_kin_details,
            'other_details': loan.other_details,
            'signed_documents': getattr(loan, 'signed_documents', None),
        },
        'investor': {
            'id': investor.id,
            'name': f"{investor.first_name} {investor.surname}",
            'email': investor.email,
            'phone': investor.phone
        },
        'repayments': [
            {
                'repayment_id': r.id,
                'amount_paid': r.amount_paid,
                'date_paid': r.date_paid.isoformat(),
                'status': r.status,
                'proof': r.proof
            } for r in repayments
        ]
    }), 200


# -------------------- View repayments for a loan --------------------
@app.route('/api/admin/loans/<int:loan_id>/repayments', methods=['GET'])
@jwt_required()
@admin_required
def view_loan_repayments_admin(loan_id):
    repayments = LoanRepayment.query.filter_by(loan_id=loan_id).order_by(LoanRepayment.date_paid.desc()).all()
    return jsonify([
        {
            'repayment_id': r.id,
            'amount_paid': r.amount_paid,
            'date_paid': r.date_paid.isoformat(),
            'status': r.status,
            'proof': r.proof
        } for r in repayments
    ]), 200


# -------------------- Get investor loans --------------------
@app.route('/api/investor/loans', methods=['GET'])
@jwt_required()
def get_investor_loans():
    investor_id = get_jwt_identity()
    status = request.args.get('status')  # optional filter

    # Base query
    query = LoanApplication.query.filter_by(investor_id=investor_id)
    if status:
        query = query.filter_by(status=status)

    # Fetch all matching loans, newest first
    loans = query.order_by(LoanApplication.submitted_at.desc()).all()

    result = []
    for loan in loans:
        # calculate total repayable
        total_repayable = None
        if loan.amount is not None and loan.interest_rate is not None:
            total_repayable = round(loan.amount * (1 + loan.interest_rate / 100), 2)

        # Append every loan to the result
        result.append({  
            "loan_id": loan.id,
            "amount": loan.amount,
            "investor_id": loan.investor_id,
            "purpose": loan.purpose,
            "status": loan.status,
            "interest_rate": loan.interest_rate,
            "total_repayable": total_repayable,
            "repayment_due_date": loan.repayment_due_date.isoformat() if loan.repayment_due_date else None,
            "collateral": loan.collateral,
            "next_of_kin_details": loan.next_of_kin_details,
            "other_details": loan.other_details,
            "signed_documents": loan.signed_documents,
            "submitted_at": loan.submitted_at.isoformat()
        })

    # Wrap in 'loans' key so frontend reads res.data.loans
    return jsonify({"loans": result}), 200

@app.route('/api/investor/loans/<int:loan_id>/signed-docs', methods=['GET'])
@jwt_required()
def investor_download_signed_docs(loan_id):
    investor_id = int(get_jwt_identity())  # ✅ Cast to int
    loan = LoanApplication.query.get_or_404(loan_id)
    if loan.investor_id != investor_id:
        return jsonify({"error": "Unauthorized"}), 403

    filename = loan.signed_documents
    if not filename:
        return jsonify({"error": "No signed documents uploaded"}), 404

    uploads = app.config['UPLOAD_FOLDER']
    response = send_from_directory(uploads, filename)
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Authorization')
    return response

# -------------------- List pending repayments --------------------
@app.route('/api/investor/repayments', methods=['GET'])
@jwt_required()
def list_loan_repayments():
    investor_id = get_jwt_identity()
    
    # pagination params
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
    except ValueError:
        return jsonify({'error': 'Invalid pagination parameters'}), 400
    
    search = request.args.get('search', '').strip()
    
    # base query: only approved loans waiting repayment
    q = LoanApplication.query \
        .filter_by(investor_id=investor_id, status='approved')
    
    # optional server‑side search
    if search:
        try:
            amt = float(search)
            q = q.filter((LoanApplication.id.ilike(f"%{search}%")) | (LoanApplication.amount == amt))
        except ValueError:
            q = q.filter(LoanApplication.id.ilike(f"%{search}%"))
    
    total = q.count()
    pages = ceil(total / per_page)
    
    loans = q.order_by(LoanApplication.repayment_due_date) \
             .offset((page - 1) * per_page) \
             .limit(per_page) \
             .all()
    
    # shape the JSON
    loan_list = []
    now = datetime.utcnow()
    for loan in loans:
        due_date_iso = loan.repayment_due_date.isoformat() if loan.repayment_due_date else None
        days_left = None
        if loan.repayment_due_date:
            days_left = (loan.repayment_due_date - now).days
        loan_list.append({
            'loan_id': loan.id,
            'amount': loan.amount,
            'repayment_due_date': due_date_iso,
            'days_left': days_left,
            'status': loan.status,
            'collateral': loan.collateral,
            'total_repayable': round(loan.amount * (1 + loan.interest_rate / 100), 2) if loan.amount and loan.interest_rate is not None else None
        })
    
    return jsonify({
        'loans': loan_list,
        'page': page,
        'pages': pages,
        'total': total
    }), 200

# -------------------- Submit repayment proof --------------------
@app.route('/api/investor/repay', methods=['POST'])
@jwt_required()
def submit_loan_repayment():
    # 1) Parse and validate JWT sub as integer
    raw_sub = get_jwt_identity()
    try:
        investor_id = int(raw_sub)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid token identity'}), 400

    # 2) Extract form data
    loan_id = request.form.get('loan_id')
    file = request.files.get('proof')
    if not loan_id or not file:
        return jsonify({'error': 'Loan ID and proof are required'}), 400

    try:
        loan_id = int(loan_id)
    except ValueError:
        return jsonify({'error': 'Invalid loan ID'}), 400

    # 3) Fetch and authorize
    loan = LoanApplication.query.get_or_404(loan_id)
    app.logger.debug(f"JWT sub: {raw_sub} ({type(raw_sub)})")
    app.logger.debug(f"Loan.investor_id: {loan.investor_id} ({type(loan.investor_id)})")
    if loan.investor_id != investor_id:
        return jsonify({'error': 'Unauthorized to repay this loan'}), 403

    # 4) Compute expected repayment amount
    principal = float(loan.amount)
    rate = float(getattr(loan, 'interest_rate', 0))
    expected_amount = round(principal * (1 + rate / 100), 2)

    # 5) Validate and save the uploaded file
    allowed_exts = {'png', 'jpg', 'jpeg', 'pdf'}
    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in allowed_exts:
        return jsonify({
            'error': f'File type not allowed. Allowed: {allowed_exts}'
        }), 400

    filename = secure_filename(
        f"repay_proof_{int(datetime.utcnow().timestamp())}_{file.filename}"
    )
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    # 6) Persist the repayment record
    repayment = LoanRepayment(
        loan_id=loan_id,
        amount_paid=expected_amount,
        date_paid=datetime.utcnow(),
        proof=filename,
        status='pending'
    )
    # now assign the FK
    repayment.investor_id = investor_id

    db.session.add(repayment)
    db.session.commit()

    # 7) Audit log entry
    audit_log(
        investor_id,
        'investor',
        f"Submitted repayment for loan {loan_id}, amount {expected_amount:.2f}"
    )

    # 8) Return success
    return jsonify({
        'message': 'Repayment submitted',
        'repayment_id': repayment.id,
        'amount_charged': f"{expected_amount:.2f}"
    }), 201
# -------------------- Admin view repayments --------------------
@app.route('/api/admin/pending-repayments', methods=['GET'])
@jwt_required()
def get_pending_repayments_admin():
    # -- Admin role check --
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({"msg": "Admins only!"}), 403

    # -- Query params with safe defaults --
    search   = request.args.get('search',   default='', type=str).strip()
    page     = request.args.get('page',     default=1,   type=int)
    per_page = request.args.get('per_page', default=10,  type=int)

    # -- Base query (only pending) --
    query = LoanRepayment.query.filter_by(status='pending')

    if search:
        # Join LoanApplication to enable searching by investor name
        query = query.join(LoanApplication).filter(
            or_(
                LoanApplication.full_name.ilike(f"%{search}%"),
                LoanRepayment.status.ilike(f"%{search}%")
            )
        )

    # -- Pagination --
    pagination = query \
        .order_by(LoanRepayment.date_paid.desc()) \
        .paginate(page=page, per_page=per_page, error_out=False)

    # -- Serialize results --
    result = []
    for repay in pagination.items:
        result.append({
            "repayment_id": repay.id,
            "loan_id": repay.loan_id,
            "amount": repay.amount,
            "status": repay.status,
            "uploaded_at": repay.uploaded_at.isoformat() if repay.uploaded_at else None,
            "proof_url": repay.proof_url,
            "investor_full_name": repay.loan_application.full_name
        })

    return jsonify({
        "repayments": result,
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages
    }), 200

@app.route('/api/admin/loan-repayments', methods=['GET'])
@jwt_required()
@admin_required
def admin_view_repayments():
    # --- query params ---
    status   = request.args.get('status', default='', type=str).strip()
    page     = request.args.get('page',   default=1,  type=int)
    per_page = request.args.get('per_page', default=10, type=int)

    # --- base query on LoanRepayment ---
    q = LoanRepayment.query
    if status:
        q = q.filter(LoanRepayment.status == status)

    pag = q.order_by(LoanRepayment.date_paid.desc())\
           .paginate(page=page, per_page=per_page, error_out=False)

    rows = []
    for r in pag.items:
        # manually load loan and investor
        loan = db.session.get(LoanApplication, r.loan_id)
        inv  = db.session.get(Investor, loan.investor_id)

        principal = float(loan.amount)
        rate      = float(loan.interest_rate or 0)
        expected  = round(principal * (1 + rate/100), 2)

        # build public URL for the proof file
        proof_url = url_for(
            'admin_download_repayment_proof',
            repayment_id=r.id,
            _external=True
        )

        rows.append({
            'repayment_id':    r.id,
            'loan_id':         loan.id,
            'investor_name':   f"{inv.first_name} {inv.surname}",
            'amount_paid':     float(r.amount_paid),
            'interest_rate':   rate,
            'expected_amount': expected,
            'status':          r.status,
            'date_paid':       r.date_paid.isoformat() if r.date_paid else None,
            'proof_url':       proof_url,
        })

    return jsonify({
        'repayments': rows,
        'total':      pag.total,
        'page':       pag.page,
        'pages':      pag.pages
    }), 200

@app.route('/api/admin/loan-repayments/<int:repayment_id>/proof', methods=['GET'])
@jwt_required()
@admin_required
def admin_download_repayment_proof(repayment_id):
    """Serves the proof file as an attachment."""
    rep = LoanRepayment.query.get_or_404(repayment_id)
    filename = rep.proof
    folder   = current_app.config['UPLOAD_FOLDER']
    return send_from_directory(folder, filename, as_attachment=True)

# -------------------- Add admin notes/docs to loan --------------------
@app.route('/api/admin/loans/<int:loan_id>/add-info', methods=['POST'])
@jwt_required()
@admin_required
def add_loan_info(loan_id):
    loan = LoanApplication.query.get_or_404(loan_id)
    data = request.form
    file = request.files.get('signed_docs')

    loan.collateral = data.get('collateral_description', loan.collateral)
    loan.next_of_kin_details = data.get('next_of_kin_name', loan.next_of_kin_details)
    # save signed document if provided
    if file:
        filename = secure_filename(f"loan_{loan_id}_signed_{file.filename}")
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(path)
        loan.signed_documents = filename

    db.session.commit()
    return jsonify({'message': 'Loan info updated'}), 200

@app.route('/api/admin/loans/<int:loan_id>/signed-docs', methods=['GET','OPTIONS'])
@jwt_required()
@admin_required
def download_loan_signed_docs(loan_id):
    # CORS preflight
    if request.method == 'OPTIONS':
        return '', 200

    loan = LoanApplication.query.get_or_404(loan_id)
    filename = getattr(loan, 'signed_documents', None)
    if not filename:
        return jsonify(error="No signed documents"), 404

    uploads = app.config['UPLOAD_FOLDER']
    # Assuming you saved signed docs at UPLOAD_FOLDER/<filename>
    response = send_from_directory(uploads, filename)
    response.headers.add('Access-Control-Allow-Origin',  'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Authorization')
    return response

# -------------------- Loan analytics --------------------
@app.route('/api/admin/loan-stats', methods=['GET'])
@jwt_required()
@admin_required
def get_loan_stats():
    status_counts = dict(db.session.query(
        LoanApplication.status,
        func.count()
    ).group_by(LoanApplication.status).all())

    total_loaned = db.session.query(func.sum(LoanApplication.amount)).scalar() or 0.0
    total_repaid = db.session.query(func.sum(LoanRepayment.amount_paid)).filter_by(status='approved').scalar() or 0.0
    avg_loan = db.session.query(func.avg(LoanApplication.amount)).scalar() or 0.0

    def range_label(amount):
        if amount < 100:
            return 'small'
        elif amount < 350:
            return 'medium'
        else:
            return 'large'

    range_counts = {'small': 0, 'medium': 0, 'large': 0}
    all_loans = LoanApplication.query.all()
    for loan in all_loans:
        label = range_label(loan.amount)
        range_counts[label] += 1

    six_months_ago = datetime.utcnow() - timedelta(days=180)
    monthly_counts = db.session.query(
        func.strftime('%Y-%m', LoanApplication.approved_at).label('month'),
        func.count()
    ).filter(
        LoanApplication.approved_at != None,
        LoanApplication.approved_at >= six_months_ago
    ).group_by('month').order_by('month').all()

    monthly_data = {month: count for month, count in monthly_counts}
    outstanding = total_loaned - total_repaid

    return jsonify({
        'by_status': status_counts,
        'total_loaned': round(total_loaned, 2),
        'total_repaid': round(total_repaid, 2),
        'outstanding': round(outstanding, 2),
        'average_loan': round(avg_loan, 2),
        'by_range': range_counts,
        'loans_by_month': monthly_data
    }), 200

# -------------------- Approve Loan Repayment --------------------
@app.route("/api/admin/approve-repayment", methods=["POST"])
@jwt_required()
@admin_required
def approve_repayments():
    data = request.get_json() or {}
    ids = data.get("repayment_ids", [])
    if not isinstance(ids, list) or not ids:
        return jsonify(error="repayment_ids (non‑empty list) is required"), 400

    updated = []
    loans_to_check = set()

    for rid in ids:
        rep = LoanRepayment.query.get(rid)
        if not rep:
            continue
        if rep.status == "pending":
            rep.status = "approved"
            updated.append(rid)
            loans_to_check.add(rep.loan_id)
    db.session.commit()

    # Now check each affected loan for full repayment
    results = {}
    for loan_id in loans_to_check:
        loan = LoanApplication.query.get(loan_id)
        total_paid = db.session.query(func.sum(LoanRepayment.amount_paid)) \
                            .filter_by(loan_id=loan.id, status="approved") \
                            .scalar() or 0.0
        # total due = principal + (principal * interest_rate/100)
        due = loan.amount + (loan.amount * loan.interest_rate / 100)
        if total_paid >= due and loan.status != "repaid":
            loan.status = "repaid"
            db.session.commit()
        results[loan_id] = {
            "total_paid": total_paid,
            "loan_status": loan.status
        }

    return jsonify({
        "approved_ids": updated,
        "loan_updates": results
    }), 200

# -------------------- Reject Loan Repayment --------------------
@app.route("/api/admin/reject-repayment", methods=["POST"])
@jwt_required()
@admin_required
def reject_repayment():
    data = request.get_json()
    repayment_id = data.get("repayment_id")
    if not repayment_id:
        return jsonify({"error": "Repayment ID is required"}), 400

    repayment = LoanRepayment.query.get(repayment_id)
    if not repayment:
        return jsonify({"error": "Repayment not found"}), 404

    if repayment.status == "rejected":
        return jsonify({"message": "Repayment already rejected"}), 400
    if repayment.status == "approved":
        return jsonify({"error": "Repayment was approved, cannot reject"}), 400

    repayment.status = "rejected"
    db.session.commit()

    return jsonify({"message": "Repayment rejected"}), 200

# -------------------- Update Loan Details --------------------
@app.route('/api/admin/update-loan-details/<int:loan_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_loan_details(loan_id):
    loan = LoanApplication.query.get_or_404(loan_id)
    data = request.form

    collateral = data.get('collateral')
    next_of_kin_details = data.get('next_of_kin_details')
    # Accept signed document file upload as well (optional)
    file = request.files.get('signed_documents')

    if collateral is not None:
        loan.collateral = collateral
    if next_of_kin_details is not None:
        loan.next_of_kin_details = next_of_kin_details
    if file:
        filename = secure_filename(f"loan_{loan_id}_signed_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        loan.signed_documents = filename

    db.session.commit()
    audit_log(get_jwt_identity(), 'admin', f"Updated loan details for loan {loan_id}")
    return jsonify({'message': 'Loan details updated'}), 200

# -------------------- Calculate Investment Rate --------------------
@app.route('/api/investment-rate', methods=['POST'])
@jwt_required()
def investment_rate():
    data = request.get_json()
    if not data:
        return jsonify(error="Missing JSON body"), 400

    amount = data.get('amount')
    duration_months = data.get('duration_months')

    if amount is None or duration_months is None:
        return jsonify(error="Both 'amount' and 'duration_months' are required"), 400

    try:
        amount = float(amount)
        duration_months = int(duration_months)
    except (ValueError, TypeError):
        return jsonify(error="Invalid 'amount' or 'duration_months'"), 400

    if amount < 28 or duration_months < 1 or duration_months > 24:
        return jsonify(error="Amount must be at least $28 and duration between 1 and 24 months"), 400

    rate = calculate_interest_rate(amount, duration_months)
    if rate == 0:
        return jsonify(error="No applicable interest rate found for the given amount and duration"), 400

    return jsonify(rate=rate), 200

# -------------------- Investor Summary --------------------
@app.route('/api/investor/summary', methods=['GET'])
@jwt_required()
def investor_summary():
    investor_id = get_jwt_identity()
    total_invested = db.session.query(func.sum(Investment.amount))\
                      .filter_by(investor_id=investor_id, status='approved').scalar() or 0
    active_loans = LoanApplication.query.filter_by(investor_id=investor_id, status='approved').count()
    notifications = Notification.query.filter_by(investor_id=investor_id)\
                    .order_by(Notification.date.desc()).limit(5).all()
    notification_list = [{'message': n.message, 'date': n.date.isoformat()} for n in notifications]
    return jsonify({
        'total_invested': total_invested,
        'active_loans': active_loans,
        'notifications': notification_list
    })

# -------------------- Investor Dashboard Summary --------------------
@app.route('/api/investor/dashboard', methods=['GET'])
@jwt_required()
@investor_required
def investor_dashboard():
    investor_id = get_jwt_identity()

    # 1) Investments
    approved_investments = Investment.query.filter_by(
        investor_id=investor_id, status='approved'
    ).all()
    total_invested = sum(inv.amount for inv in approved_investments)
    total_returns  = sum(inv.projected_value() for inv in approved_investments)

    # 2) Loans & repayable calculation
    loans = LoanApplication.query.filter_by(investor_id=investor_id).all()
    total_loans    = len(loans)
    active_loans   = len([ln for ln in loans if ln.status == 'approved'])

    # sum principal + interest on all approved loans
    total_repayable = sum(
        loan.amount * (1 + loan.interest_rate / 100)
        for loan in loans
        if loan.status == 'approved'
    )

    # 3) Repayments received
    repayments = LoanRepayment.query.join(LoanApplication).filter(
        LoanApplication.investor_id == investor_id
    ).all()
    total_repaid = sum(r.amount_paid for r in repayments if r.status == 'approved')

    # 4) Pending withdrawals
    pending_withdrawals = WithdrawalRequest.query.filter_by(
        investor_id=investor_id, status='pending'
    ).count()

    return jsonify({
        "investment_summary": {
            "count":           len(approved_investments),
            "total_invested":  round(total_invested, 2),
            "total_returns":   round(total_returns, 2)
        },
        "loan_summary": {
            "total_loans":     total_loans,
            "active_loans":    active_loans,
            "total_repayable": round(total_repayable, 2)
        },
        "repayment_summary": {
            "total_repaid":    round(total_repaid, 2)
        },
        "withdrawal_status": {
            "pending_requests": pending_withdrawals
        }
    })

# -------------------- Admin Dashboard Summary --------------------
@app.route('/api/admin/dashboard-summary', methods=['GET'])
@jwt_required()
@admin_required
def admin_dashboard_summary():
    today = date.today()

    # --- Compute the 8th→7th window ---
    if today.day >= 8:
        window_start_day = today.replace(day=8)
        window_end_day   = (today + relativedelta(months=1)).replace(day=7)
    else:
        prev_month       = today - relativedelta(months=1)
        window_start_day = prev_month.replace(day=8)
        window_end_day   = today.replace(day=7)

    # As datetimes for comparison
    window_start = datetime.combine(window_start_day, time.min)
    window_end   = datetime.combine(window_end_day,   time.max)

    # 1) Investors & approved-funds
    approved_investors = Investor.query.filter(Investor.is_approved).count()
    approved_funds     = db.session.query(
        func.coalesce(func.sum(Investment.amount), 0)
    ).filter(Investment.status == 'approved').scalar() or 0

    # 2) Loan counts
    active_loans  = LoanApplication.query.filter_by(status='approved').count()
    pending_loans = LoanApplication.query.filter_by(status='pending').count()
    total_loans   = LoanApplication.query.count()

    # 3) Loan‑repayable in window
    loan_repayable = 0.0
    loans_due = LoanApplication.query.filter_by(status='approved') \
        .filter(
            LoanApplication.repayment_due_date.between(window_start_day, window_end_day)
        ).all()
    for loan in loans_due:
        loan_repayable += loan.amount * (1 + loan.interest_rate / 100)

    # 4) Investment‑payouts in window via Python filter
    payouts_due  = 0.0
    matching_ids = []
    investments = Investment.query.filter_by(status='approved') \
                     .filter(Investment.approved_at != None).all()
    for inv in investments:
        ewd = inv.expected_withdrawal_date  # datetime or None
        if ewd and window_start <= ewd <= window_end:
            payouts_due  += inv.projected_value()
            matching_ids.append(inv.id)

    return jsonify({
        "overview": {
            "approved_investors":                       approved_investors,
            "approved_funds":                           float(approved_funds),
            "active_loans":                             active_loans,
            "pending_loans":                            pending_loans,
            "total_loans":                              total_loans,
            "loan_repayments_amount_due_this_month":     round(loan_repayable, 2),
            "investment_payouts_amount_due_this_month": round(payouts_due,     2)
        },
        "debug": {
            "window_start":            window_start.isoformat(),
            "window_end":              window_end.isoformat(),
            "matching_investment_ids": matching_ids
        },
        "chart_data": {
            "loans": {
                "approved": active_loans,
                "pending":  pending_loans,
                "total":    total_loans
            },
            "repayments": {
                "due_amount_this_month": round(loan_repayable, 2),
                "approved_amount": float(
                    db.session.query(func.coalesce(func.sum(LoanRepayment.amount_paid), 0))
                        .filter_by(status='approved').scalar() or 0
                ),
                "rejected_amount": float(
                    db.session.query(func.coalesce(func.sum(LoanRepayment.amount_paid), 0))
                        .filter_by(status='rejected').scalar() or 0
                )
            },
            "investments": {
                "due_payout_amount_this_month": round(payouts_due, 2),
                "total_invested_amount": float(
                    db.session.query(func.coalesce(func.sum(Investment.amount), 0))
                        .filter_by(status='approved').scalar() or 0
                )
            }
        }
    })

# -------------------- Export Investments CSV --------------------
@app.route('/api/admin/export-investments', methods=['GET'])
@admin_required
def export_investments_csv():
    investments = Investment.query.all()

    si = io.StringIO()
    cw = csv.writer(si)

    # CSV header
    cw.writerow([
        'ID', 'Investor ID', 'Amount', 'Rate', 'Duration (months)', 'Status',
        'Created At', 'Expected Return', 'Expected Withdrawal Date',
        'Withdrawal Requested', 'Withdrawal Paid', 'Proof of Payment', 'Withdrawal Proof'
    ])

    for inv in investments:
        expected_return = inv.current_value() if hasattr(inv, 'current_value') else ''
        withdrawal_date = inv.withdrawal_date.strftime('%Y-%m-%d') if inv.withdrawal_date else ''
        cw.writerow([
            inv.id,
            inv.investor_id,
            inv.amount,
            inv.rate,
            inv.duration_months,
            inv.status,
            inv.date.strftime('%Y-%m-%d') if inv.date else '',
            expected_return,
            withdrawal_date,
            inv.withdrawal_requested,
            inv.withdrawal_paid,
            inv.proof_of_payment,
            inv.withdrawal_payment_proof
        ])

    output = make_response(si.getvalue())
    output.headers['Content-Disposition'] = 'attachment; filename=investments.csv'
    output.headers['Content-Type'] = 'text/csv'
    return output


# Get loan applications with optional status filter
@app.route('/api/admin/loan-applications', methods=['GET'])
@jwt_required()
def get_loan_applications_admin():
    # -- Admin role check --
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({"msg": "Admins only!"}), 403

    # -- Query params with safe defaults --
    status   = request.args.get('status',   default='',  type=str).strip()
    search   = request.args.get('search',   default='',  type=str).strip()
    page     = request.args.get('page',     default=1,   type=int)
    per_page = request.args.get('per_page', default=10,  type=int)

    # -- Build base query --
    query = LoanApplication.query

    if status:
        query = query.filter_by(status=status)

    if search:
        query = query.filter(
            or_(
                LoanApplication.full_name.ilike(f"%{search}%"),
                LoanApplication.email.ilike(f"%{search}%"),
                LoanApplication.phone.ilike(f"%{search}%"),
                LoanApplication.purpose.ilike(f"%{search}%")
            )
        )

    # -- Pagination --
    pagination = query \
        .order_by(LoanApplication.submitted_at.desc()) \
        .paginate(page=page, per_page=per_page, error_out=False)

    # -- Serialize results --
    result = []
    for loan in pagination.items:
        result.append({
            "loan_id": loan.id,
            "investor_id": loan.investor_id,
            "full_name": loan.full_name,
            "email": loan.email,
            "phone": loan.phone,
            "amount": loan.amount,
            "purpose": loan.purpose,
            "status": loan.status,
            "submitted_at": loan.submitted_at.isoformat() if loan.submitted_at else None,
            "interest_rate": loan.interest_rate,
            "repayment_due_date": (
                loan.repayment_due_date.isoformat()
                if loan.status == 'approved' and loan.repayment_due_date
                else None
            ),
            "collateral": loan.collateral,
            "next_of_kin_details": loan.next_of_kin_details,
            "other_details": loan.other_details
        })

    return jsonify({
        "loans": result,
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages
    }), 200

# Export loans CSV
@app.route('/api/admin/export/loans', methods=['GET'])
@jwt_required()
def export_loans():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({"msg": "Admins only!"}), 403

    loans = LoanApplication.query.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Investor ID', 'Amount', 'Interest Rate', 'Repayment Date', 'Status'])
    for l in loans:
        repayment_date = l.repayment_due_date.strftime('%Y-%m-%d') if l.repayment_due_date else ''
        writer.writerow([l.id, l.investor_id, l.amount, l.interest_rate, repayment_date, l.status])

    output.seek(0)
    return send_file(
        io.BytesIO(output.read().encode('utf-8')),
        mimetype='text/csv',
        download_name='loans.csv',
        as_attachment=True
    )

# Get recent audit logs (max 100)
@app.route('/api/admin/audit-logs', methods=['GET'])
@jwt_required()
def get_audit_logs():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({"msg": "Admins only!"}), 403

    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).all()
    return jsonify(logs=[{
    'actor_id': l.actor_id,
    'role': l.role,
    'action': l.action,
    'timestamp': l.timestamp.isoformat(),
    'details': l.details,
    'ip_address': l.ip_address,
    'user_agent': l.user_agent
} for l in logs])

# Get investor status
@app.route('/api/investor/status', methods=['GET'])
@jwt_required()
def get_investor_status():
    investor_id = get_jwt_identity()
    investor = Investor.query.get(investor_id)

    if not investor:
        return jsonify({"msg": "Investor not found"}), 404

    return jsonify({
        "is_approved": investor.is_approved,
        "full_name": f"{investor.first_name} {investor.surname}",
        "email": investor.email,
        "phone": investor.phone,
        "id_number": investor.id_number
    }), 200


# Get investor notifications
@app.route('/api/investor/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    notifs = Notification.query.filter_by(investor_id=user_id).order_by(Notification.date.desc()).all()
    return jsonify([n.to_dict() for n in notifs])

# Mark one notification as read
@app.route('/api/investor/notifications/read', methods=['POST'])
@jwt_required()
def read_notification():
    user_id = get_jwt_identity()
    notif_id = request.json.get('id')
    notif = Notification.query.filter_by(id=notif_id, investor_id=user_id).first_or_404()
    notif.read = True
    db.session.commit()
    return '', 204

# Mark all as read
@app.route('/api/investor/notifications/read-all', methods=['POST'])
@jwt_required()
def read_all_notifications():
    user_id = get_jwt_identity()
    Notification.query.filter_by(investor_id=user_id, read=False).update({'read': True})
    db.session.commit()
    return '', 204

# Simple health check
@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({'message': 'pong', 'status': 'ok'})

# -------------------- Investor Email Resend Confirmation --------------------
@app.route('/api/investor-resend-confirmation', methods=['POST'])
def resend_confirmation():
    # Accept JSON or form‑encoded body
    data = request.get_json(silent=True) or request.form
    email = data.get('email')
    if not email:
        return render_template(
            'investor_resend_confirmation.html',
            success=False,
            error="Please provide your email address."
        ), 400

    investor = Investor.query.filter_by(email=email).first()
    if not investor:
        return render_template(
            'investor_resend_confirmation.html',
            success=False,
            error="No account found with that email."
        ), 404
    if investor.is_confirmed:
        return render_template(
            'investor_resend_confirmation.html',
            success=False,
            error="Your email is already confirmed."
        ), 400

    # Generate new token
    token = serializer.dumps(investor.email, salt='email-confirm')
    confirm_url = url_for('confirm_investor_email', token=token, _external=True)

    # Send email using the simple activate.html (or personalized) template
    html = render_template('activate.html', confirm_url=confirm_url,
                           new_investor=investor)
    send_email(to=investor.email,
               subject='Your new AC Finance confirmation link',
               html_body=html)

    # Render the success page
    return render_template(
        'investor_resend_confirmation.html',
        success=True,
        email=investor.email
    ), 200

# -------------------- Investor Email Confirmation --------------------
@app.route('/api/investor-confirm/<token>', methods=['GET'])
def confirm_investor_email(token):
    try:
        email = serializer.loads(
            token,
            salt='email-confirm',
            max_age=CONFIRM_TOKEN_EXPIRATION
        )
    except Exception:
        # Token invalid or expired → show page with resend form
        return render_template(
            'investor_confirmed.html',
            error="Your confirmation link has expired. Enter your email below to get a new one."
        ), 400

    investor = Investor.query.filter_by(email=email).first_or_404()
    if not investor.is_confirmed:
        investor.is_confirmed = True
        db.session.commit()
        audit_log(investor.id, 'investor', 'Email confirmed')

    return render_template('investor_confirmed.html'), 200

# -------------------- Investor Password Reset Request --------------------
@app.route('/api/investor-request-password-reset', methods=['POST'])
def investor_request_password_reset():
    data = request.get_json() or {}
    email = data.get('email')
    if not email:
        return jsonify(error="Email is required"), 400

    investor = Investor.query.filter_by(email=email).first()
    if not investor:
        # Avoid revealing whether email exists
        return jsonify(message="If that email is registered, you’ll receive a reset link"), 200

    # Generate reset token
    token = serializer.dumps(investor.email, salt='password-reset')
    reset_url = url_for('investor_reset_password', token=token, _external=True)

    # Send email
    html = render_template(
        'reset_password_email.html',
        investor=investor,
        reset_url=reset_url
    )
    send_email(
        to=investor.email,
        subject='AC Finance Password Reset',
        html_body=html
    )

    return jsonify(message="If that email is registered, you’ll receive a reset link"), 200

# -------------------- Investor Password Reset Form --------------------
@app.route('/investor-reset-password/<token>', methods=['GET', 'POST'])
def investor_reset_password(token):
    # 1) Validate token
    try:
        email = serializer.loads(
            token,
            salt='password-reset',
            max_age=PASSWORD_RESET_EXPIRATION
        )
    except Exception:
        return render_template(
            'reset_password_form.html',
            error="Link expired or invalid. Please request a new reset."
        ), 400

    investor = Investor.query.filter_by(email=email).first_or_404()

    if request.method == 'POST':
        pw  = request.form.get('password')
        cpw = request.form.get('confirm_password')

        if not pw or pw != cpw:
            return render_template(
                'reset_password_form.html',
                error="Passwords must match and not be empty."
            ), 400

        # Update password
        investor.password_hash = generate_password_hash(pw, method='pbkdf2:sha256')
        db.session.commit()
        audit_log(investor.id, 'investor', 'Password reset')

        return render_template(
            'reset_password_form.html',
            error=None
        ), 200  # you can redirect to a “success” page or login page instead

    # GET → show form
    return render_template('reset_password_form.html'), 200

if __name__ == '__main__':
    # Ensure all tables are created before first request
    with app.app_context():
        db.create_all()

    # Run Flask with HTTPS so cookies marked Secure will be accepted
    app.run(
        host='127.0.0.1',
        port=5000,
        ssl_context=('cert.pem', 'key.pem')
    )
