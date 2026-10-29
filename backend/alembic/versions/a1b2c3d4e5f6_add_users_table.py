"""add users table and missing columns

Revision ID: a1b2c3d4e5f6
Revises: f123456789ab
Create Date: 2026-08-03 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f123456789ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'users' not in tables:
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(), nullable=False),
            sa.Column('hashed_password', sa.String(), nullable=True),
            sa.Column('full_name', sa.String(), nullable=True),
            sa.Column('avatar_url', sa.String(), nullable=True),
            sa.Column('provider', sa.String(), server_default='email', nullable=True),
            sa.Column('provider_id', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    else:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'hashed_password' not in columns:
            op.add_column('users', sa.Column('hashed_password', sa.String(), nullable=True))
        if 'full_name' not in columns:
            op.add_column('users', sa.Column('full_name', sa.String(), nullable=True))
        if 'avatar_url' not in columns:
            op.add_column('users', sa.Column('avatar_url', sa.String(), nullable=True))
        if 'provider' not in columns:
            op.add_column('users', sa.Column('provider', sa.String(), server_default='email', nullable=True))
        if 'provider_id' not in columns:
            op.add_column('users', sa.Column('provider_id', sa.String(), nullable=True))
        if 'created_at' not in columns:
            op.add_column('users', sa.Column('created_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    pass
