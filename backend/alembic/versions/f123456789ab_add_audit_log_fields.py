"""add_audit_log_fields

Revision ID: f123456789ab
Revises: d02228d842a9
Create Date: 2026-07-30 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f123456789ab'
down_revision: Union[str, Sequence[str], None] = 'd02228d842a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('audit_log', sa.Column('flag_key', sa.String(length=100), nullable=True))
    op.add_column('audit_log', sa.Column('environment', sa.String(length=100), nullable=True))
    op.add_column('audit_log', sa.Column('previous_state', sa.JSON(), nullable=True))
    op.add_column('audit_log', sa.Column('new_state', sa.JSON(), nullable=True))
    op.create_index(op.f('ix_audit_log_flag_key'), 'audit_log', ['flag_key'], unique=False)
    op.create_index(op.f('ix_audit_log_environment'), 'audit_log', ['environment'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_audit_log_environment'), table_name='audit_log')
    op.drop_index(op.f('ix_audit_log_flag_key'), table_name='audit_log')
    op.drop_column('audit_log', 'new_state')
    op.drop_column('audit_log', 'previous_state')
    op.drop_column('audit_log', 'environment')
    op.drop_column('audit_log', 'flag_key')
