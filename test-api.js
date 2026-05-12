/**
 * 本地测试 api/calendar.js
 * 用法：node test-api.js
 */

const fs = require('fs');
const path = require('path');

// 模拟 Vercel 的 req/res 对象
function createMockReq(query) {
  return {
    method: 'GET',
    query: query || {},
  };
}

function createMockRes() {
  const chunks = [];
  return {
    headers: {},
    statusCode: 200,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    send(data) { chunks.push(data); },
    json(obj) { chunks.push(JSON.stringify(obj)); },
    end() {
      const result = chunks.join('');
      if (this.headers['Content-Type'] && this.headers['Content-Type'].includes('text/calendar')) {
        // 写入测试输出文件
        const outPath = path.join(__dirname, 'output', 'test-output.ics');
        fs.writeFileSync(outPath, result, 'utf8');
        console.log(`✅ 测试成功！输出已写入：${outPath}`);
        console.log(`   Content-Type: ${this.headers['Content-Type']}`);
        console.log(`   文件大小：${(result.length / 1024).toFixed(1)} KB`);
        // 显示前 20 行
        const lines = result.split('\n').slice(0, 20);
        console.log('\n--- ICS 预览（前 20 行）---');
        lines.forEach((line, i) => console.log(`${(i+1).toString().padStart(3)}: ${line}`));
        if (result.split('\n').length > 20) console.log('   ... (truncated)');
      } else {
        console.log('响应：', result);
      }
    },
  };
}

async function runTest() {
  console.log('=== 本地测试 api/calendar.js ===\n');

  // 确保 output 目录存在
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const handler = require('./api/calendar.js');

  // 测试 1：默认参数（所有源）
  console.log('[测试 1] 默认参数（所有源）...');
  let req = createMockReq({});
  let res = createMockRes();
  await handler(req, res);
  res.end();

  console.log('\n---\n');

  // 测试 2：只请求节假日
  console.log('[测试 2] 只请求节假日（sources=holidays）...');
  req = createMockReq({ sources: 'holidays', year: '2026' });
  res = createMockRes();
  await handler(req, res);
  res.end();

  console.log('\n---\n');

  // 测试 3：农历 + 节气
  console.log('[测试 3] 农历 + 节气（sources=lunar,solar）...');
  req = createMockReq({ sources: 'lunar,solar', year: '2026' });
  res = createMockRes();
  await handler(req, res);
  res.end();

  console.log('\n---\n');
  console.log('✅ 所有测试完成！');
  console.log('   检查 output/test-output.ics 查看生成的日历文件');
}

runTest().catch(err => {
  console.error('❌ 测试失败：', err);
  process.exit(1);
});
