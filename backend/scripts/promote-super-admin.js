const db = require('../db');

// Promote the first admin user to super admin (admin_level = 1)
// Run this script once to set up the initial super admin

async function promoteFirstSuperAdmin() {
    try {
        // Find the first admin user
        const query = `
            SELECT user_id, fullname, email 
            FROM users 
            WHERE role = 'admin' 
            ORDER BY created_at ASC 
            LIMIT 1
        `;
        
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error finding admin user:', err);
                process.exit(1);
            }
            
            if (results.length === 0) {
                console.log('No admin users found. Please create an admin user first.');
                process.exit(1);
            }
            
            const admin = results[0];
            
            // Update to super admin level
            db.query(
                'UPDATE users SET admin_level = 1 WHERE user_id = ?',
                [admin.user_id],
                (updateErr) => {
                    if (updateErr) {
                        console.error('Error promoting to super admin:', updateErr);
                        process.exit(1);
                    }
                    
                    console.log(`✅ Successfully promoted ${admin.fullname} (${admin.email}) to Super Admin`);
                    console.log('They can now access the super admin dashboard at /super-admin.html');
                    process.exit(0);
                }
            );
        });
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

promoteFirstSuperAdmin();