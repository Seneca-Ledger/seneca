import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../src/data-source';
import { User, UserRole, Workspace, WorkspaceMember, WorkspaceRole } from '../src/entities';
import { DEV_DEFAULTS } from '../src/common/utils/dev-defaults';

const DEFAULT_EMAIL = DEV_DEFAULTS.ADMIN_EMAIL;
const DEFAULT_PASSWORD = DEV_DEFAULTS.ADMIN_PASSWORD;
const DEFAULT_NAME = DEV_DEFAULTS.ADMIN_NAME;

async function createAdmin() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);
    const workspaceRepository = AppDataSource.getRepository(Workspace);
    const workspaceMemberRepository = AppDataSource.getRepository(WorkspaceMember);

    const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
    const password = process.argv[3] || DEFAULT_PASSWORD;
    const name = process.argv[4] || DEFAULT_NAME;

    const passwordHash = await bcrypt.hash(password, 10);

    const existingUser = await userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        name: true
      },
    });

    let adminUser: User;

    if (!existingUser) {
      adminUser = await userRepository.save(
        userRepository.create({
          email,
          passwordHash,
          name,
          role: UserRole.ADMIN,
          isActive: true,
        }),
      );

      console.log('✅ Admin user created successfully');
    } else {
      const updatePayload: Partial<Pick<User, 'passwordHash' | 'role' | 'isActive' | 'name'>> = {
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      };

      if (!existingUser.name || existingUser.name.trim() === '') {
        updatePayload.name = name;
      }

      await userRepository.update(existingUser.id, updatePayload);

      console.log(`✅ Updated admin user ${email}`);
      console.log('   Role set to admin, password rotated, account activated');
    }

    adminUser = (await userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        workspaceId: true,
        lastWorkspaceId: true
      },
    })) as User;

    let workspaceId = adminUser.workspaceId;
    if (!workspaceId) {
      const workspace = await workspaceRepository.save(
        workspaceRepository.create({
          name: `${adminUser.name || adminUser.email} workspace`,
          ownerId: adminUser.id,
        }),
      );
      workspaceId = workspace.id;
      await userRepository.update(adminUser.id, {
        workspaceId,
        lastWorkspaceId: workspaceId,
      });
      console.log(`✅ Workspace created for admin: ${workspace.name} (${workspace.id})`);
    }

    const existingMembership = await workspaceMemberRepository.findOne({
      where: { workspaceId: workspaceId as string, userId: adminUser.id },
      select: {
        id: true
      },
    });

    if (!existingMembership) {
      await workspaceMemberRepository.save(
        workspaceMemberRepository.create({
          workspaceId: workspaceId as string,
          userId: adminUser.id,
          role: WorkspaceRole.OWNER,
          invitedById: adminUser.id,
        }),
      );
      console.log('✅ Workspace membership ensured for admin');
    }

    console.log(`   Email: ${email}`);
    if (!process.argv[3]) {
      console.log('   Password: the dev default (DEV_DEFAULTS.ADMIN_PASSWORD)');
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

createAdmin();
