const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createAdmin() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://seneca:seneca@seneca-postgres:5432/seneca',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const email = process.argv[2] || 'admin@example.com';
    const password = process.argv[3] || 'admin123';
    const name = process.argv[4] || 'Administrator';

    // Check if user exists
    const existingUser = await client.query('SELECT id, email, role FROM users WHERE email = $1', [
      email,
    ]);

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.role === 'admin') {
        console.log(`⚠️  Admin user with email ${email} already exists`);
        console.log('   Updating password...');
        const passwordHash = await bcrypt.hash(password, 10);
        await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
          passwordHash,
          email,
        ]);
        console.log(`✅ Password updated for admin user ${email}`);
      } else {
        console.log(`⚠️  User ${email} exists with role ${user.role}`);
        console.log('   Updating to admin role...');
        const passwordHash = await bcrypt.hash(password, 10);
        await client.query('UPDATE users SET role = $1, password_hash = $2 WHERE email = $3', [
          'admin',
          passwordHash,
          email,
        ]);
        console.log(`✅ User ${email} updated to admin role`);
      }
    } else {
      // Create new admin user
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await client.query(
        `INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at, permissions)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW(), NULL)
         RETURNING email, name, role`,
        [email, passwordHash, name, 'admin', true],
      );

      console.log(`✅ Admin user created successfully!`);
      console.log(`   Email: ${result.rows[0].email}`);
      console.log(`   Name: ${result.rows[0].name}`);
      console.log(`   Role: ${result.rows[0].role}`);
      console.log(`   Password: ${password}`);
      console.log(`\n⚠️  IMPORTANT: Change the password after first login!`);
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.message.includes('relation "users" does not exist')) {
      console.error(
        '\n⚠️  Database tables not created yet. Please wait for the application to start and create tables.',
      );
      console.error('   Or check if synchronize is enabled in database config.');
    }
    await client.end();
    process.exit(1);
  }
}

createAdmin();
