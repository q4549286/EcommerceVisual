import { config } from "dotenv";
import pg from "pg";

config();

const { Client } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("缺少 DATABASE_URL，请在 .env 中配置。");
  process.exit(1);
}

const action = process.argv[2];
const phone = process.argv[3];

async function withClient(fn) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function listUsers() {
  await withClient(async (client) => {
    const result = await client.query(
      `SELECT phone, role, status, credits, "createdAt", "lastLoginAt" FROM "User" ORDER BY "createdAt" ASC`
    );
    if (result.rows.length === 0) {
      console.log("（暂无用户）");
      return;
    }
    console.log("\n手机号                角色    状态     积分   注册时间                   最近登录");
    console.log("-".repeat(96));
    for (const row of result.rows) {
      const phone = String(row.phone).padEnd(20, " ");
      const role = String(row.role).padEnd(7, " ");
      const status = String(row.status).padEnd(8, " ");
      const credits = String(row.credits).padEnd(6, " ");
      const created = new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19).padEnd(20, " ");
      const last = row.lastLoginAt ? new Date(row.lastLoginAt).toISOString().replace("T", " ").slice(0, 19) : "-";
      console.log(`${phone} ${role} ${status} ${credits} ${created} ${last}`);
    }
  });
}

async function setRole(phoneArg, role) {
  if (!phoneArg) {
    console.error(`请提供手机号: node scripts/admin.mjs ${role === "ADMIN" ? "promote" : "demote"} <phone>`);
    process.exit(1);
  }
  await withClient(async (client) => {
    const result = await client.query(`UPDATE "User" SET role = $1 WHERE phone = $2 RETURNING phone, role`, [role, phoneArg]);
    if (result.rowCount === 0) {
      console.error(`未找到手机号 ${phoneArg}。`);
      process.exit(1);
    }
    console.log(`已更新：${result.rows[0].phone} -> ${result.rows[0].role}`);
  });
}

async function setStatus(phoneArg, status) {
  if (!phoneArg) {
    console.error(`请提供手机号: node scripts/admin.mjs ${status === "ACTIVE" ? "enable" : "disable"} <phone>`);
    process.exit(1);
  }
  await withClient(async (client) => {
    const result = await client.query(`UPDATE "User" SET status = $1 WHERE phone = $2 RETURNING phone, status`, [status, phoneArg]);
    if (result.rowCount === 0) {
      console.error(`未找到手机号 ${phoneArg}。`);
      process.exit(1);
    }
    console.log(`已更新：${result.rows[0].phone} -> ${result.rows[0].status}`);
  });
}

async function main() {
  switch (action) {
    case "list":
      return listUsers();
    case "promote":
      return setRole(phone, "ADMIN");
    case "demote":
      return setRole(phone, "USER");
    case "enable":
      return setStatus(phone, "ACTIVE");
    case "disable":
      return setStatus(phone, "DISABLED");
    default:
      console.log("用法：");
      console.log("  node scripts/admin.mjs list                  # 列出全部用户");
      console.log("  node scripts/admin.mjs promote <phone>       # 提升为管理员");
      console.log("  node scripts/admin.mjs demote <phone>        # 降为普通用户");
      console.log("  node scripts/admin.mjs enable <phone>        # 启用账号");
      console.log("  node scripts/admin.mjs disable <phone>       # 停用账号");
      process.exit(action ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
