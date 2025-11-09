# 用户管理系统实现计划

## 项目概述

基于Supabase实现用户管理系统，包括用户登录、收藏功能和后台管理。

## 技术选型

✅ **已选择：Supabase**
- 原因：最适合Jekyll静态站点，无需后端代码
- 成本：免费（50,000 MAU，500MB数据库）
- 技术栈：Jekyll + Supabase JavaScript SDK

## 功能需求

### 1. 用户认证
- [ ] 支持GitHub OAuth登录
- [ ] 支持Google OAuth登录
- [ ] 支持邮箱/密码登录（可选）
- [ ] 用户注册流程
- [ ] 登录状态持久化
- [ ] 退出登录功能

### 2. 用户收藏
- [ ] 收藏论文功能
- [ ] 取消收藏功能
- [ ] 查看我的收藏列表
- [ ] 收藏状态显示（文章页和列表页）
- [ ] 收藏计数显示

### 3. 后台管理
- [ ] 用户列表查看
- [ ] 用户详情查看
- [ ] 登录日志查看
- [ ] 收藏统计查看
- [ ] 管理员权限控制

## 数据库设计

### 表结构

```sql
-- 用户表（Supabase自动管理，auth.users）
-- id, email, created_at, ...

-- 用户档案表
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  full_name TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 收藏表
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_url)
);

-- 登录日志表
CREATE TABLE login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_post_url ON favorites(post_url);
CREATE INDEX idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX idx_login_logs_login_at ON login_logs(login_at DESC);
```

### Row Level Security (RLS) 策略

```sql
-- profiles表：用户可以查看所有用户档案，只能更新自己的
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- favorites表：用户只能查看和操作自己的收藏
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

-- login_logs表：用户只能查看自己的登录日志，管理员可以查看所有
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own login logs"
  ON login_logs FOR SELECT
  USING (auth.uid() = user_id);
```

## 实施计划

### 阶段一：Supabase项目设置（1小时）

- [ ] 创建Supabase项目
- [ ] 配置OAuth提供商（GitHub、Google）
- [ ] 创建数据库表
- [ ] 设置RLS策略
- [ ] 测试数据库连接

### 阶段二：前端认证集成（4-6小时）

- [ ] 安装Supabase JavaScript SDK
- [ ] 创建认证服务模块 (`assets/js/auth.js`)
- [ ] 实现登录/注册UI组件
- [ ] 实现登录状态管理
- [ ] 添加登录/注册页面或模态框
- [ ] 集成到现有页面（header）

### 阶段三：收藏功能实现（4-6小时）

- [ ] 创建收藏服务模块 (`assets/js/favorites.js`)
- [ ] 在文章页面添加收藏按钮
- [ ] 在列表页显示收藏状态
- [ ] 实现收藏/取消收藏逻辑
- [ ] 创建"我的收藏"页面
- [ ] 添加收藏统计显示

### 阶段四：后台管理（4-6小时）

- [ ] 创建管理员认证逻辑
- [ ] 创建管理后台页面 (`/admin/index.html`)
- [ ] 实现用户列表功能
- [ ] 实现登录日志查看功能
- [ ] 实现收藏统计功能
- [ ] 添加数据导出功能（可选）

### 阶段五：UI/UX优化（2-4小时）

- [ ] 优化登录/注册界面
- [ ] 添加加载状态和错误处理
- [ ] 添加收藏动画效果
- [ ] 响应式设计优化
- [ ] 添加用户头像显示

### 阶段六：测试和部署（2-4小时）

- [ ] 功能测试
- [ ] 安全性测试
- [ ] 性能测试
- [ ] 文档更新
- [ ] 部署到生产环境

## 文件结构

```
papercache/
├── assets/
│   ├── js/
│   │   ├── auth.js              # 认证服务
│   │   ├── favorites.js         # 收藏服务
│   │   └── admin.js             # 后台管理服务
│   ├── css/
│   │   ├── auth.css             # 认证相关样式
│   │   └── admin.css            # 后台管理样式
├── _layouts/
│   ├── admin.html               # 后台管理布局
│   └── user-profile.html        # 用户档案布局
├── admin/
│   ├── index.html               # 管理后台首页
│   ├── users.html               # 用户列表
│   └── logs.html                # 登录日志
├── account/
│   ├── favorites.html           # 我的收藏
│   └── profile.html             # 个人资料
└── _includes/
    ├── auth-modal.html          # 登录/注册模态框
    └── user-menu.html            # 用户菜单
```

## 配置项

需要添加到 `_config.yml` 的配置：

```yaml
# Supabase配置
supabase:
  url: "https://your-project.supabase.co"
  anon_key: "your-anon-key"
  
# 管理员配置
admin:
  enabled: true
  admin_emails:
    - "admin@example.com"
```

## 安全考虑

1. **API密钥保护**
   - 使用环境变量存储敏感信息
   - 前端只使用anon key（受RLS保护）
   - service role key只在服务器端使用

2. **认证流程**
   - 使用OAuth而非密码（更安全）
   - 实现JWT token刷新机制
   - 添加登录状态验证

3. **数据安全**
   - RLS策略确保数据隔离
   - 防止SQL注入（使用Supabase SDK）
   - 防止XSS攻击（内容转义）

## 用户体验设计

### 登录流程
1. 用户点击"登录"按钮
2. 弹出登录模态框或跳转到登录页
3. 选择登录方式（GitHub/Google/邮箱）
4. 授权后返回，显示用户信息
5. 更新页面UI（显示用户名、头像）

### 收藏流程
1. 用户浏览文章列表或文章详情
2. 点击"收藏"按钮（心形图标）
3. 显示加载状态
4. 成功后更新按钮状态（已收藏/未收藏）
5. 显示收藏动画反馈

### 后台管理流程
1. 管理员访问 `/admin`
2. 验证管理员权限
3. 显示管理面板
4. 可以查看用户、日志、统计等信息

## 待解决问题

- [ ] 确定管理员权限的实现方式（邮箱白名单？角色表？）
- [ ] 确定登录日志的触发方式（Supabase Hook？前端记录？）
- [ ] 确定用户头像的来源（GitHub头像？上传功能？）
- [ ] 确定收藏功能的UI位置（文章页？列表页？两者都有？）

## 时间估算

**总计：17-26小时（约2-3个工作日）**

- 项目设置：1小时
- 认证集成：4-6小时
- 收藏功能：4-6小时
- 后台管理：4-6小时
- UI优化：2-4小时
- 测试部署：2-4小时

## 下一步行动

1. ✅ 创建功能分支
2. ⏳ 设置Supabase项目
3. ⏳ 创建数据库表结构
4. ⏳ 实现基础认证功能
5. ⏳ 逐步迭代其他功能

---

*创建时间：2025-01-XX*
*分支：feature/user-management*




