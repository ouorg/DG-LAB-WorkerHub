const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const row = payload?.[0]?.results?.[0];
if (!payload?.[0]?.success || row?.bootstrap_completed !== 1 || row?.settings_count < 8 || row?.admin_count !== 1) {
  console.error("D1 bootstrap verification failed", JSON.stringify(payload, null, 2));
  process.exit(1);
}
console.log(`D1 bootstrap verified: ${row.settings_count} settings and ${row.admin_count} admin user`);
