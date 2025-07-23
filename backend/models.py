from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from math import pow
from dateutil.relativedelta import relativedelta

db = SQLAlchemy()

# ------------------- Admin User -------------------

class AdminUser(db.Model):
    __tablename__ = 'admin_user'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


# ------------------- Investor -------------------

class Investor(db.Model):
    __tablename__ = 'investor'

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80))
    surname = db.Column(db.String(80))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)

    # Contact & verification
    phone = db.Column(db.String(20))
    phone_verified = db.Column(db.Boolean, default=False)
    phone_verification_token = db.Column(db.String(100), nullable=True)
    email_verified = db.Column(db.Boolean, default=False)
    email_verification_token = db.Column(db.String(100), nullable=True)

    # Reset
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)

    # Identity
    id_number = db.Column(db.String(50))
    address = db.Column(db.String(255))
    next_of_kin = db.Column(db.String(100))
    phone_of_kin = db.Column(db.String)

    # File uploads (filenames only)
    proof_of_residence = db.Column(db.String(200))  # → uploads/investors/residence_proofs/
    id_document = db.Column(db.String(200))         # → uploads/investors/id_photos/
    face_photo = db.Column(db.String(200))          # → uploads/investors/face_photos/

    is_approved = db.Column(db.Boolean, default=False)
    is_rejected = db.Column(db.Boolean, default=False, nullable=False) 
    is_confirmed = db.Column(db.Boolean, nullable=False, default=False)
    balance = db.Column(db.Float, default=0.0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    investments = db.relationship('Investment', backref='investor', lazy=True)
    loans = db.relationship('LoanApplication', backref='investor', lazy=True)
    notifications = db.relationship('Notification', backref='investor', lazy=True)
    withdrawal_requests = db.relationship('WithdrawalRequest', backref='investor', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def update_balance(self, amount_change, commit=True):
        self.balance = (self.balance or 0) + amount_change
        if commit:
            db.session.commit()

    def to_dict(self):
        return {
            'id': self.id,
            'first_name': self.first_name,
            'surname': self.surname,
            'username': self.username,
            'email': self.email,
            'phone': self.phone,
            'id_number': self.id_number,
            'address': self.address,
            'next_of_kin': self.next_of_kin,
            'phone_of_kin': self.phone_of_kin,
            'proof_of_residence': self.proof_of_residence,
            'id_document': self.id_document,
            'face_photo': self.face_photo,
            'is_approved': self.is_approved,
            'balance': self.balance,
            'created_at': self.created_at.isoformat(),
        }


# ------------------- Investment -------------------

class Investment(db.Model):
    __tablename__ = 'investment'

    id = db.Column(db.Integer, primary_key=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('investor.id'), nullable=False)

    amount = db.Column(db.Float, nullable=False)
    duration_months = db.Column(db.Integer, nullable=False)
    rate = db.Column(db.Float, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at = db.Column(db.DateTime, nullable=True)

    status = db.Column(db.String(50), default='pending')  # pending, approved, withdrawal_requested, paid, completed
    is_authorized = db.Column(db.Boolean, default=False)

    proof_of_payment = db.Column(db.String(200))  # → uploads/investments/proofs_of_payment/

    withdrawals = db.relationship('WithdrawalRequest', backref='investment', lazy=True)

    def start_date(self):
        return self.approved_at or self.created_at

    @property
    def months(self):
        if not self.start_date():
            return 0
        delta = relativedelta(datetime.utcnow(), self.start_date())
        return max(1, delta.years * 12 + delta.months)

    @property
    def expected_withdrawal_date(self):
        if not self.approved_at:
            return None
        return self.approved_at + relativedelta(months=self.duration_months)
    
    @property
    def expected_maturity_date(self):
        """Return a date object (not datetime) for when the term ends."""
        if not self.approved_at:
            return None
        # approved_at is a datetime → convert to date, then add months
        mat_dt = self.approved_at + relativedelta(months=self.duration_months)
        return mat_dt.date()

    @property
    def withdrawable_date(self):
        """
        Snap maturity into the 28→8 window:
        - If maturity.day >= 28 → same-month 28th
        - Else → next-month 8th
        """
        mat = self.expected_maturity_date  # this is now a date
        if not mat:
            return None

        if mat.day >= 28:
            return mat.replace(day=28)
        # use datetime to build next-month date, then grab .date()
        next_month_dt = datetime(mat.year, mat.month, mat.day) + relativedelta(months=1)
        return next_month_dt.replace(day=8).date()

    @property
    def total_return(self):
        principal = self.amount
        months = self.months
        monthly_rate = self.calculate_rate(principal, months) / 100
        return round(principal * ((1 + monthly_rate) ** months), 2)

    def projected_value(self):
        return round(self.amount * ((1 + self.rate / 100) ** self.duration_months), 2)

    def current_value(self):
        elapsed = min(self.months, self.duration_months)
        return round(self.amount * ((1 + self.rate / 100) ** elapsed), 2)

    @staticmethod
    def calculate_rate(amount, months):
        if amount < 100:
            return 8 if months <= 3 else 10 if months <= 6 else 12
        elif amount < 200:
            return 10 if months <= 3 else 12 if months <= 6 else 13
        else:
            return 12 if months <= 3 else 14 if months <= 6 else 15

    def to_dict(self):
        return {
            'id': self.id,
            'investor_id': self.investor_id,
            'amount': self.amount,
            'duration_months': self.duration_months,
            'rate': self.rate,
            'status': self.status,
            'proof_of_payment': self.proof_of_payment,
            'created_at': self.created_at.isoformat(),
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
        }


# ------------------- Loan Application -------------------

class LoanApplication(db.Model):
    __tablename__ = 'loan_application'

    id = db.Column(db.Integer, primary_key=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('investor.id'), nullable=True)
    full_name = db.Column(db.String(100))
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(30))
    amount = db.Column(db.Float, nullable=False)
    purpose = db.Column(db.String(255))
    status = db.Column(db.String(20), default='pending')
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    interest_rate = db.Column(db.Float)
    repayment_due_date = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)

    collateral = db.Column(db.String(255))
    next_of_kin_details = db.Column(db.String(255))
    other_details = db.Column(db.Text)
    signed_documents = db.Column(db.String(255))

    repayments = db.relationship('LoanRepayment', backref='loan', lazy=True)

    def assign_interest_rate(self):
        if self.amount < 100:
            self.interest_rate = 25.0
        elif self.amount < 350:
            self.interest_rate = 20.0
        else:
            self.interest_rate = 17.0


# ------------------- Notification -------------------

class Notification(db.Model):
    __tablename__ = 'notification'

    id = db.Column(db.Integer, primary_key=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('investor.id'), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    read = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'investor_id': self.investor_id,
            'message': self.message,
            'date': self.date.isoformat() if self.date else None,
            'read': self.read,
        }


# ------------------- Loan Repayment -------------------

class LoanRepayment(db.Model):
    __tablename__ = 'loan_repayment'

    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey('loan_application.id'), nullable=False)
    amount_paid = db.Column(db.Float, nullable=False)
    date_paid = db.Column(db.DateTime, default=datetime.utcnow)
    proof = db.Column(db.String(200))
    method = db.Column(db.String(50))
    status = db.Column(db.String(20), default="pending")


# ------------------- Audit Log -------------------

class AuditLog(db.Model):
    __tablename__ = 'audit_log'

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, nullable=False)
    role = db.Column(db.String(20))
    action = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(255))


# ------------------- Withdrawal Request -------------------

class WithdrawalRequest(db.Model):
    __tablename__ = 'withdrawal_request'

    id = db.Column(db.Integer, primary_key=True)
    investment_id = db.Column(db.Integer, db.ForeignKey('investment.id'), nullable=False)
    investor_id = db.Column(db.Integer, db.ForeignKey('investor.id'), nullable=False)

    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='pending')  # pending → paid

    proof_of_payment = db.Column(db.String(200))  # → uploads/withdrawals/
    admin_comment = db.Column(db.String(255))     # Optional

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
