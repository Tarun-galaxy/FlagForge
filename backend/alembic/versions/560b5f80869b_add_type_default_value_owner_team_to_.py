"""add_type_default_value_owner_team_to_flags

Revision ID: 560b5f80869b
Revises: 9c4c17581d97
Create Date: 2026-07-09 18:58:35.785598

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '560b5f80869b'
down_revision: Union[str, Sequence[str], None] = '9c4c17581d97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('flags', sa.Column('type', sa.String(length=50), nullable=False, server_default='boolean'))
    op.add_column('flags', sa.Column('default_value', sa.String(length=500), nullable=False, server_default='false'))
    op.add_column('flags', sa.Column('owner_team', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('flags', 'owner_team')
    op.drop_column('flags', 'default_value')
    op.drop_column('flags', 'type')
