# Profile查询超时问题排查和解决方案

## 问题描述
用户登录时出现错误：`getUserProfile: 异常 查询profile超时（3000ms）- 可能是数据库连接问题或RLS策略限制`

## 可能的原因

### 1. 🔗 **数据库连接问题**
- **网络连接不稳定**：本地网络或Supabase服务器连接问题
- **Supabase服务器响应慢**：服务器负载过高或维护中
- **CORS或防火墙限制**：本地开发环境的网络限制

### 2. 🔐 **RLS策略问题**
- **profiles表不存在RLS策略**：表没有启用Row Level Security
- **RLS策略过于复杂**：策略逻辑复杂导致查询超时
- **用户权限不足**：认证用户没有查询profiles的权限

### 3. 🗄️ **数据库表问题**
- **profiles表不存在**：表还没有创建
- **表结构不正确**：缺少必要的字段或索引
- **数据库锁或性能问题**：大量并发查询导致

## 解决方案

### 方案1：检查Supabase配置和连接

1. **验证Supabase URL和密钥**
   ```javascript
   // 在浏览器控制台中检查
   console.log('Supabase URL:', window.siteConfig?.supabase?.url);
   console.log('Supabase Key存在:', !!window.siteConfig?.supabase?.anon_key);
   ```

2. **测试基本连接**
   ```javascript
   // 在浏览器控制台中执行
   const supabase = window.getSupabaseClient();
   supabase.from('profiles').select('id').limit(1).then(result => {
     console.log('连接测试结果:', result);
   });
   ```

### 方案2：检查和修复RLS策略

在Supabase Dashboard的SQL Editor中执行以下SQL：

```sql
-- 1. 检查profiles表是否存在
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'profiles';

-- 2. 检查RLS是否启用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 3. 启用RLS（如果未启用）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. 创建必要的RLS策略
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- 5. 检查现有策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
```

### 方案3：创建或修复profiles表

如果表不存在，执行以下SQL：

```sql
-- 创建profiles表
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  avatar_url TEXT,
  full_name TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles(created_at);

-- 启用RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 插入测试数据（可选）
INSERT INTO profiles (id, username, full_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'test_user', 'Test User')
ON CONFLICT (id) DO NOTHING;
```

### 方案4：临时解决方案（降级处理）

如果数据库问题暂时无法解决，可以使用以下临时方案：

1. **增加超时时间**（已实现）
   - 将查询超时从2秒增加到5秒
   - 添加连接测试功能

2. **使用本地缓存**
   ```javascript
   // 在auth.js中添加缓存逻辑
   const profileCache = new Map();

   function getCachedProfile(userId) {
     const cached = profileCache.get(userId);
     if (cached && Date.now() - cached.timestamp < 300000) { // 5分钟缓存
       return cached.profile;
     }
     return null;
   }
   ```

3. **完全跳过profile查询**
   ```javascript
   // 临时修改getUserProfile函数
   async function getUserProfile(userId) {
     console.log('getUserProfile: 使用临时方案，直接返回默认profile');
     return createDefaultProfile(userId);
   }
   ```

## 诊断步骤

### 1. 浏览器控制台诊断
1. 打开开发者工具（F12）
2. 访问 http://127.0.0.1:4001/papercache/
3. 登录账号
4. 查看控制台输出，寻找以下信息：
   - `getUserProfile: 开始获取用户档案`
   - `getUserProfile: 测试数据库连接...`
   - `getUserProfile: 🔍 开始查询profile`
   - 任何错误信息

### 2. 网络诊断
1. 在Network标签页中查看Supabase请求
2. 检查请求状态码（应该是200）
3. 查看请求响应时间
4. 检查CORS错误

### 3. Supabase Dashboard诊断
1. 登录Supabase Dashboard
2. 检查Authentication > Users中的用户记录
3. 检查Database > Tables中的profiles表
4. 查看Database > Logs中的错误日志

## 推荐的解决顺序

1. **首先**：检查Supabase配置和网络连接
2. **然后**：验证RLS策略是否正确配置
3. **接着**：确认profiles表存在且有正确的结构
4. **最后**：考虑使用临时解决方案确保登录功能正常

## 联系信息

如果问题仍然存在，请：
1. 收集浏览器控制台的完整错误信息
2. 检查Supabase Dashboard中的错误日志
3. 确认网络连接正常
4. 联系技术支持并提供详细的错误信息