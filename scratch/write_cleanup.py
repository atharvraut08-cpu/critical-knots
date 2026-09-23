import os
import re

COMMAND_CONTENT = '''import re
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from core.models import Organization, Donation


class Command(BaseCommand):
    help = (
        "Safely deletes users (and cascading Organization and Donation records) "
        "where first_name/last_name are empty, or linked Organization phone number has fewer than 10 digits."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate cleanup without committing deletions to the database.',
        )
        parser.add_argument(
            '--exclude-superusers',
            action='store_true',
            help='Skip deletion of staff and superuser accounts.',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        exclude_superusers = options.get('exclude_superusers', False)

        self.stdout.write(self.style.MIGRATE_HEADING("\\n[SecondServe] Starting invalid user database cleanup..."))
        if dry_run:
            self.stdout.write(self.style.WARNING(">>> RUNNING IN DRY-RUN MODE (No database changes will be saved) <<<\\n"))

        users_to_delete = []
        user_deletion_reasons = {}

        for user in User.objects.all():
            if exclude_superusers and (user.is_superuser or user.is_staff):
                continue

            reasons = []

            # Check 1: Empty first_name
            if not user.first_name or not user.first_name.strip():
                reasons.append("first_name is empty")

            # Check 2: Empty last_name
            if not user.last_name or not user.last_name.strip():
                reasons.append("last_name is empty")

            # Check 3: Linked Organization phone number shorter than 10 digits
            org = getattr(user, 'organization', None)
            if org:
                raw_phone = org.phone_number or ''
                digits = re.sub(r'\\D', '', raw_phone)
                if len(digits) < 10:
                    reasons.append(f"Organization phone '{raw_phone}' has {len(digits)} digits (< 10 digits)")
            else:
                if not (user.is_superuser or user.is_staff):
                    reasons.append("No linked Organization record found")

            if reasons:
                users_to_delete.append(user)
                user_deletion_reasons[user.id] = reasons

        if not users_to_delete:
            self.stdout.write(self.style.SUCCESS("No invalid user accounts found. Database is clean!\\n"))
            return

        user_ids = [u.id for u in users_to_delete]
        linked_orgs = Organization.objects.filter(user_id__in=user_ids)
        linked_org_ids = list(linked_orgs.values_list('id', flat=True))

        created_donations_count = Donation.objects.filter(organization_id__in=linked_org_ids).count()
        claimed_donations_count = Donation.objects.filter(claimed_by_id__in=linked_org_ids).count()
        org_count = len(linked_org_ids)
        user_count = len(users_to_delete)

        self.stdout.write(self.style.WARNING(f"Identified {user_count} invalid User record(s) for removal:\\n"))
        for user in users_to_delete:
            reasons_str = "; ".join(user_deletion_reasons[user.id])
            org = getattr(user, 'organization', None)
            org_info = f"Org: '{org.organization_name}' ({org.phone_number})" if org else "No Org"
            self.stdout.write(f" - [ID {user.id}] {user.username} ({user.email}) | {org_info} -> Reason: {reasons_str}")

        if not dry_run:
            with transaction.atomic():
                # Cascades to delete linked Organization and created Donation records
                User.objects.filter(id__in=user_ids).delete()

            self.stdout.write(self.style.SUCCESS("\\n" + "=" * 55))
            self.stdout.write(self.style.SUCCESS("  DATABASE CLEANUP COMPLETED SUCCESSFULLY"))
            self.stdout.write(self.style.SUCCESS("=" * 55))
            self.stdout.write(f"  * Users Deleted:               {user_count}")
            self.stdout.write(f"  * Organizations Removed:       {org_count}")
            self.stdout.write(f"  * Created Donations Removed:   {created_donations_count}")
            self.stdout.write(f"  * Claimed Donations Affected:  {claimed_donations_count}")
            self.stdout.write(self.style.SUCCESS("=" * 55 + "\\n"))
        else:
            self.stdout.write(self.style.WARNING("\\n" + "=" * 55))
            self.stdout.write(self.style.WARNING("  DRY RUN SUMMARY (NO RECORDS WERE REMOVED)"))
            self.stdout.write(self.style.WARNING("=" * 55))
            self.stdout.write(f"  * Users Identified:            {user_count}")
            self.stdout.write(f"  * Organizations to Remove:     {org_count}")
            self.stdout.write(f"  * Created Donations to Remove: {created_donations_count}")
            self.stdout.write(f"  * Claimed Donations Affected:  {claimed_donations_count}")
            self.stdout.write(self.style.WARNING("=" * 55 + "\\n"))
            self.stdout.write("Run without --dry-run to commit deletions.\\n")
'''

target_path = r'D:\Projects\SEWDLmini\ReRoute\backend\core\management\commands\cleanup_invalid_users.py'
with open(target_path, 'w', encoding='utf-8') as f:
    f.write(COMMAND_CONTENT)
print("Successfully created cleanup_invalid_users.py")
