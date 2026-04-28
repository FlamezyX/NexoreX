# Super Admin Dashboard Setup Guide

## Overview
The Super Admin Dashboard provides comprehensive control over the NexoreX platform, including team management, platform settings, and analytics.

## Initial Setup

### 1. Database Setup
Run the database upgrade script to create the necessary tables:

```sql
-- Execute this SQL script in your database
source database/super_admin_upgrade.sql
```

This creates:
- `platform_settings` table for bank details and configurations
- `admin_permissions` table for granular sub-admin permissions
- `password_resets` table for forgot password functionality
- Adds `admin_level` column to users table

### 2. Promote First Super Admin
After creating an admin user, promote them to super admin:

```bash
cd backend
node scripts/promote-super-admin.js
```

This will:
- Find the first admin user in the database
- Set their `admin_level` to 1 (super admin)
- Allow them to access the super admin dashboard

### 3. Access the Dashboard
Super admins can access the dashboard at:
```
/super-admin.html
```

## Features

### Team Management
- **View Admin Team**: See all current admins with their permissions
- **Promote Users**: Search and promote buyers/sellers to sub-admin roles
- **Permission Control**: Grant specific permissions to sub-admins:
  - Seller Applications
  - Product Approvals
  - Payment Confirmations
  - Withdrawals
  - Shipping Options
  - Review Moderation
  - Seller Reports
  - Analytics
- **Demote Admins**: Remove admin privileges from sub-admins

### Platform Settings
- **Bank Details**: Configure platform bank account for payments
- **Withdrawal Settings**: Set hold periods and minimum amounts
- **Seller Terms**: Edit terms and conditions shown to sellers

### Fee Management
- **Activation Fee Waiver**: Search and waive ₦3,000 activation fees for sellers
- **Fee Restoration**: Restore fees if needed

### Communication
- **Message Team**: Direct chat with sub-admins and sellers
- **Search Function**: Find team members quickly

### Analytics
- **Platform Metrics**: View key statistics:
  - Total users and active sellers
  - Order counts and revenue
  - Pending applications
  - Active products
- **Recent Orders**: Monitor latest platform activity

## Security Features

### Access Control
- Only users with `admin_level = 1` can access super admin features
- Sub-admins (`admin_level = 2`) have limited permissions
- JWT tokens include admin level for secure authentication

### Permission System
- Granular permissions for sub-admins
- Super admins always have full access
- Permissions checked on every API call

### CSRF Protection
- Content-Type validation
- Origin header verification
- Secure API endpoints

## API Endpoints

### Super Admin Routes (`/api/super-admin/`)
- `GET /admins` - List all admins with permissions
- `GET /analytics` - Platform analytics data
- `GET /search-users` - Search users to promote
- `GET /search-team` - Search sub-admins and sellers
- `GET /search-sellers` - Search sellers for fee waiver
- `POST /promote` - Promote user to sub-admin
- `PATCH /permissions/:adminId` - Update sub-admin permissions
- `PATCH /waive-fee/:applicationId` - Toggle activation fee
- `DELETE /demote/:adminId` - Demote sub-admin

### Platform Settings (`/api/platform-settings/`)
- `GET /` - Get platform settings (public)
- `PUT /` - Update platform settings (super admin only)

## Usage Tips

1. **First Time Setup**: 
   - Run database upgrade
   - Promote first super admin
   - Configure bank details
   - Set up seller terms

2. **Team Management**:
   - Start with trusted users for sub-admin roles
   - Grant minimal permissions initially
   - Monitor sub-admin activity

3. **Platform Configuration**:
   - Keep bank details updated
   - Review seller terms regularly
   - Adjust withdrawal settings as needed

4. **Monitoring**:
   - Check analytics regularly
   - Monitor pending applications
   - Review recent orders for issues

## Troubleshooting

### Common Issues

1. **Cannot Access Dashboard**
   - Ensure user has `admin_level = 1`
   - Check JWT token includes admin_level
   - Verify database has admin_level column

2. **Permission Errors**
   - Check admin_permissions table exists
   - Verify foreign key constraints
   - Ensure sub-admin has required permissions

3. **Settings Not Saving**
   - Check platform_settings table exists
   - Verify API endpoints are working
   - Check for database connection issues

### Database Verification
```sql
-- Check if tables exist
SHOW TABLES LIKE '%admin%';
SHOW TABLES LIKE 'platform_settings';

-- Check admin levels
SELECT user_id, fullname, email, role, admin_level FROM users WHERE role = 'admin';

-- Check permissions
SELECT * FROM admin_permissions;
```

## Security Considerations

1. **Super Admin Access**: Only grant to highly trusted individuals
2. **Regular Audits**: Review admin permissions periodically  
3. **Secure Environment**: Use HTTPS in production
4. **Database Security**: Secure database access and backups
5. **Monitoring**: Log admin actions for audit trails

The super admin dashboard provides powerful platform control - use responsibly and maintain security best practices.