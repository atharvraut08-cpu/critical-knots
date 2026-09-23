import os

# 1. Path to serializers.py
serializers_path = r'D:\Projects\SEWDLmini\ReRoute\backend\core\serializers.py'
with open(serializers_path, 'r', encoding='utf-8') as f:
    serializers_content = f.read()

# Make sure 'import re' is present
if 'import re' not in serializers_content:
    serializers_content = 'import re\n' + serializers_content

# Replace RegisterSerializer in serializers.py
old_register_pattern = '''class RegisterSerializer(serializers.Serializer):
    """
    Serializer for user registration that creates both a User and their linked Organization.
    Strictly validates unique emails and usernames, minimum 8 character passwords,
    and valid role choices ('Donor' or 'Recipient').
    """
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    organization_name = serializers.CharField(max_length=255, required=True)
    role = serializers.CharField(max_length=50, required=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    address = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_username(self, value):
        val = value.strip()
        if User.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return val

    def validate_email(self, value):
        val = value.strip()
        # Verify email is unique across both User and Organization models
        if User.objects.filter(email__iexact=val).exists() or Organization.objects.filter(contact_email__iexact=val).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return val

    def validate_role(self, value):
        val = value.strip().capitalize()
        # Strictly accept only 'Donor' or 'Recipient'
        if val in ['Volunteer', 'Ngo', 'Recipient']:
            return 'Recipient'
        elif val == 'Donor':
            return 'Donor'
        raise serializers.ValidationError("Role must be strictly 'Donor' or 'Recipient'.")

    def create(self, validated_data):
        username = validated_data['username']
        email = validated_data['email']
        password = validated_data['password']
        org_name = validated_data['organization_name']
        role = validated_data['role']
        phone = validated_data.get('phone_number', '')
        address = validated_data.get('address', '')

        # Create standard Django User with hashed password
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        # Create linked Organization
        organization = Organization.objects.create(
            user=user,
            organization_name=org_name,
            role=role,
            contact_email=email,
            phone_number=phone,
            address=address or 'City Center'
        )

        # Generate auth Token
        token, _ = Token.objects.get_or_create(user=user)

        return {
            'user': user,
            'organization': organization,
            'token': token.key
        }'''

new_register_serializer = '''class RegisterSerializer(serializers.Serializer):
    """
    Serializer for user registration that creates both a User and their linked Organization.
    Strictly validates unique emails and usernames, minimum 8 character passwords,
    valid role choices ('Donor' or 'Recipient'), numeric-free names, and valid phone numbers.
    """
    first_name = serializers.CharField(max_length=150, required=True)
    last_name = serializers.CharField(max_length=150, required=True)
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    organization_name = serializers.CharField(max_length=255, required=True)
    role = serializers.CharField(max_length=50, required=True)
    phone_number = serializers.CharField(max_length=20, required=True)
    address = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_first_name(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("First name is required.")
        if re.search(r'\\d', val):
            raise serializers.ValidationError("First name cannot contain numbers.")
        if not re.match(r"^[a-zA-Z\\s\\-']+$", val):
            raise serializers.ValidationError("First name contains invalid characters.")
        return val

    def validate_last_name(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Last name is required.")
        if re.search(r'\\d', val):
            raise serializers.ValidationError("Last name cannot contain numbers.")
        if not re.match(r"^[a-zA-Z\\s\\-']+$", val):
            raise serializers.ValidationError("Last name contains invalid characters.")
        return val

    def validate_organization_name(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Organization name is required.")
        if re.search(r'\\d', val):
            raise serializers.ValidationError("Organization name cannot contain numbers.")
        return val

    def validate_phone_number(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Phone number is required.")
        # Strictly accept only numbers and optional leading '+' symbol
        if not re.match(r'^\\+?[0-9]{10,15}$', val):
            raise serializers.ValidationError("Phone number must contain only numbers and an optional leading '+', between 10 and 15 digits.")
        digits = re.sub(r'\\D', '', val)
        if len(digits) < 10 or len(digits) > 15:
            raise serializers.ValidationError("Phone number must contain between 10 and 15 digits.")
        return val

    def validate_username(self, value):
        val = value.strip()
        if User.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return val

    def validate_email(self, value):
        val = value.strip()
        # Verify email is unique across both User and Organization models
        if User.objects.filter(email__iexact=val).exists() or Organization.objects.filter(contact_email__iexact=val).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return val

    def validate_role(self, value):
        val = value.strip().capitalize()
        # Strictly accept only 'Donor' or 'Recipient'
        if val in ['Volunteer', 'Ngo', 'Recipient']:
            return 'Recipient'
        elif val == 'Donor':
            return 'Donor'
        raise serializers.ValidationError("Role must be strictly 'Donor' or 'Recipient'.")

    def create(self, validated_data):
        username = validated_data['username']
        email = validated_data['email']
        password = validated_data['password']
        first_name = validated_data['first_name']
        last_name = validated_data['last_name']
        org_name = validated_data['organization_name']
        role = validated_data['role']
        phone = validated_data['phone_number']
        address = validated_data.get('address', '')

        # Create standard Django User with hashed password, first_name and last_name
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )

        # Create linked Organization
        organization = Organization.objects.create(
            user=user,
            organization_name=org_name,
            role=role,
            contact_email=email,
            phone_number=phone,
            address=address or 'City Center'
        )

        # Generate auth Token
        token, _ = Token.objects.get_or_create(user=user)

        return {
            'user': user,
            'organization': organization,
            'token': token.key
        }'''

if old_register_pattern in serializers_content:
    serializers_content = serializers_content.replace(old_register_pattern, new_register_serializer)
    with open(serializers_path, 'w', encoding='utf-8') as f:
        f.write(serializers_content)
    print("Updated core/serializers.py successfully.")
else:
    print("WARNING: Could not find exact old_register_pattern in serializers.py!")

# 2. Update views.py to include first_name and last_name in response
views_path = r'D:\Projects\SEWDLmini\ReRoute\backend\core\views.py'
with open(views_path, 'r', encoding='utf-8') as f:
    views_content = f.read()

old_user_resp = """                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                },"""

new_user_resp = """                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                },"""

if old_user_resp in views_content:
    views_content = views_content.replace(old_user_resp, new_user_resp)
    with open(views_path, 'w', encoding='utf-8') as f:
        f.write(views_content)
    print("Updated core/views.py successfully.")
else:
    print("Note: user response pattern already updated or not matched in views.py")
