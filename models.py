from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    cheatsheets = db.relationship('Cheatsheet', backref='owner', lazy=True, cascade='all, delete-orphan')
    groups = db.relationship('Group', backref='owner', lazy=True, cascade='all, delete-orphan')


class Cheatsheet(db.Model):
    __tablename__ = 'cheatsheets'

    id = db.Column(db.String(100), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    data = db.Column(db.JSON, nullable=False)
    group_id = db.Column(db.String(100), db.ForeignKey('groups.id', ondelete='SET NULL'), nullable=True)
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    images = db.relationship('Image', backref='cheatsheet', lazy=True, cascade='all, delete-orphan')


class Group(db.Model):
    __tablename__ = 'groups'

    id = db.Column(db.String(100), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(20), default='#667eea')

    cheatsheets = db.relationship('Cheatsheet', backref='group', lazy=True)


class Image(db.Model):
    __tablename__ = 'images'

    id = db.Column(db.Integer, primary_key=True)
    cheatsheet_id = db.Column(db.String(100), db.ForeignKey('cheatsheets.id', ondelete='CASCADE'), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    data = db.Column(db.LargeBinary, nullable=False)
    content_type = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('cheatsheet_id', 'filename', name='uq_cheatsheet_filename'),
    )
