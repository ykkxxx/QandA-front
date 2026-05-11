<template>
  <div class="login-page">
    <van-nav-bar
        title="用户登录"
        left-arrow
        @click-left="onClickLeft"
        fixed
    />

    <div class="login-container">
      <div class="login-logo">
        <van-image
            width="80"
            height="80"
            src="https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg"
            round
        />
        <h2>用户登录</h2>
      </div>

      <van-form @submit="onSubmit" class="login-form">
        <van-cell-group inset>
          <van-field
              v-model="username"
              name="username"
              label="用户名"
              placeholder="3-20 位字母数字下划线"
              :rules="usernameRules"
          />
          <van-field
              v-model="password"
              type="password"
              name="password"
              label="密码"
              placeholder="6-32 位字母数字下划线"
              :rules="passwordRules"
          />
        </van-cell-group>

        <div class="submit-btn">
          <van-button round block type="primary" native-type="submit" size="large">
            登录
          </van-button>
        </div>

        <div class="register-link">
          还没有账号？<span @click="goToRegister">去注册</span>
        </div>
      </van-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useUserStore } from '../store/user';
import {
  USERNAME_PATTERN,
  PASSWORD_PATTERN,
  USERNAME_RULE_MESSAGE,
  PASSWORD_RULE_MESSAGE
} from '../utils/credentialRules';

const router = useRouter();
const userStore = useUserStore();

const username = ref('');
const password = ref('');

const usernameRules = [
  { required: true, message: '请填写用户名' },
  { pattern: USERNAME_PATTERN, message: USERNAME_RULE_MESSAGE }
];
const passwordRules = [
  { required: true, message: '请填写密码' },
  { pattern: PASSWORD_PATTERN, message: PASSWORD_RULE_MESSAGE }
];

const onSubmit = async (values) => {
  try {
    // 1. 登录
    const result = await userStore.login({
      username: username.value,
      password: password.value
    });

    if (result.success) {
      // ✅ 只跳转，不调用 getUserInfoDetail()
      // 这个方法会自动在首页/路由守卫里加载
      router.push('/');
      showToast("登录成功");
    } else {
      showToast(result.message || "登录失败");
    }
  } catch (error) {
    console.error("登录异常", error);
    showToast("登录失败");
  }
};

const onClickLeft = () => {
  router.back();
};

const goToRegister = () => {
  router.push('/register');
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.login-container {
  padding-top: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-logo {
  margin: 40px 0;
  text-align: center;
}

.login-logo h2 {
  margin-top: 16px;
  color: #323233;
  font-size: 22px;
}

.login-form {
  width: 100%;
  padding: 0 16px;
}

.submit-btn {
  margin: 24px 16px;
}

.register-link {
  text-align: center;
  margin-top: 24px;
  color: #969799;
  font-size: 14px;
}

.register-link span {
  color: #1989fa;
}
</style>