<template>
  <div class="profile-page">
    <van-nav-bar
      title="个人信息"
      left-arrow
      @click-left="$router.back()"
      fixed
    />
    
    <div class="profile-container">
      <van-cell-group inset class="avatar-group">
        <van-cell title="头像" center is-link @click="showAvatarDialog">
          <template #right-icon>
            <van-image
              round
              width="60"
              height="60"
              :key="userInfo?.avatar || 'avatar'"
              :src="resolveAvatarUrl(userInfo?.avatar)"
              @error="onAvatarImgError"
            />
          </template>
        </van-cell>
      </van-cell-group>
      
      <van-cell-group inset class="info-group">
        <van-cell title="用户ID" :value="userInfo?.id || userInfo?.uuid || '未设置'" />
        <van-cell title="用户名" :value="userInfo?.username || '未设置'" is-link @click="showUsernameDialog" />
        <van-cell title="邮箱" :value="userInfo?.email || '未设置'" is-link @click="showEmailDialog" />
        <van-cell title="手机号" :value="userInfo?.telephone || '未设置'" is-link @click="showPhoneDialog" />
        <van-cell title="性别" :value="genderText || '未设置'" is-link @click="showGenderDialog" />
        <van-cell title="个人简介" :value="userBio || '暂无简介'" is-link @click="showBioDialog" />
        <van-cell title="注册时间" :value="createTimeText || '未设置'" />
        <van-cell title="最后登录时间" :value="lastLoginText || '未设置'" />
      </van-cell-group>
      
      <van-cell-group inset class="security-group">
        <van-cell title="修改密码" is-link @click="showPasswordConfirm" />
      </van-cell-group>
    </div>

    <van-popup
      v-model:show="genderSheetVisible"
      position="bottom"
      round
      :style="{ width: '100%' }"
    >
      <div style="text-align: center; font-weight: 600; padding: 12px 0 4px">选择性别</div>
      <van-radio-group v-model="genderPickValue">
        <van-cell title="男" clickable @click="genderPickValue = 1">
          <template #right-icon><van-radio :name="1" /></template>
        </van-cell>
        <van-cell title="女" clickable @click="genderPickValue = 2">
          <template #right-icon><van-radio :name="2" /></template>
        </van-cell>
        <van-cell title="未知" clickable @click="genderPickValue = 0">
          <template #right-icon><van-radio :name="0" /></template>
        </van-cell>
      </van-radio-group>
      <div style="padding: 16px">
        <van-button type="primary" block round @click="confirmGenderSheet">确定</van-button>
      </div>
    </van-popup>

    <van-popup
      v-model:show="avatarPopupVisible"
      position="bottom"
      round
      :style="{ width: '100%' }"
      @closed="onAvatarPopupClosed"
    >
      <div style="text-align: center; font-weight: 600; padding: 12px 0 4px">修改头像</div>
      <div style="text-align: center; padding: 16px">
        <van-image
          round
          width="100"
          height="100"
          :key="avatarDisplaySrc"
          :src="avatarDisplaySrc"
          @error="onAvatarImgError"
        />
      </div>
      <div style="padding: 0 16px 16px">
        <input
          type="file"
          accept="image/*"
          class="avatar-file-input"
          @change="onAvatarFileSelected"
        />
        <p style="margin: 8px 0 0; font-size: 12px; color: #969799">请选择本地图片，建议使用正方形</p>
      </div>
      <div style="padding: 16px; display: flex; gap: 8px">
        <van-button block round @click="avatarPopupVisible = false">取消</van-button>
        <van-button type="primary" block round :loading="avatarUploading" @click="confirmAvatarUpload">
          确认上传
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, h, onMounted } from 'vue';
import { useUserStore } from '../store/user';
import { showDialog, showToast, showLoadingToast, showSuccessToast, showFailToast } from 'vant';
import { useRouter } from 'vue-router';
import { resolveAvatarUrl, DEFAULT_AVATAR } from '../utils/resolveAvatarUrl';

const router = useRouter();
const userStore = useUserStore();

// 初始化用户状态
onMounted(async () => {
  // 如果用户未登录，跳转到登录页面
  if (!userStore.getLoginStatus) {
    router.push('/login');
    return;
  }
  
  // 获取用户信息
  try {
    // 显示加载提示
    const loadingInstance = showLoadingToast({
      message: '加载中...',
      forbidClick: true,
      duration: 0
    });
    
    const result = await userStore.getUserInfoDetail();

    // 手动关闭加载提示
    loadingInstance.close();
    
    if (result.success) {
      // 显示成功提示
      showSuccessToast('获取用户信息成功');
    } else {
      showFailToast(result.message || '获取用户信息失败');
    }
  } catch (error) {
    console.error('获取用户信息请求失败:', error);
    // 确保关闭加载提示
    showToast.clear();
    showToast.fail('获取用户信息失败');
  }
});

const userInfo = computed(() => userStore.userInfo);
const userId = computed(() => userStore.token ? userStore.token.substring(0, 5) : '');
const userBio = computed(() => userStore.userInfo?.bio || '暂无简介');

/** 与后端 UsersUpdateDTO 一致：0-未知 1-男 2-女（历史非法值如 3 按未知处理） */
const normalizeProfileGender = (g) => {
  const n = Number(g);
  if (n === 1 || n === 2) return n;
  return 0;
};

const genderText = computed(() => {
  const g = normalizeProfileGender(userInfo.value?.gender);
  switch (g) {
    case 1:
      return '男';
    case 2:
      return '女';
    case 0:
    default:
      return '未知';
  }
});

const createTimeText = computed(() => {
  const raw =
    userInfo.value?.date_joined ?? userInfo.value?.create_time;
  if (!raw) return '未设置';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '未设置';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
});

const lastLoginText = computed(() => {
  if (!userInfo.value?.last_login) return '未设置';
  const date = new Date(userInfo.value?.last_login);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
});

const showPasswordConfirm = () => {
  // 使用ref创建响应式变量
  const oldPassword = ref('');
  const newPassword = ref('');
  const confirmPassword = ref('');
  
  showDialog({
    title: '修改密码',
    showCancelButton: true,
    className: 'password-dialog',
    message: h('div', { style: 'text-align: left; padding: 10px 0;' }, [
      h('div', { style: 'margin-bottom: 15px;' }, [
        h('div', { style: 'margin-bottom: 5px; text-align: left;' }, '当前密码：'),
        h('input', {
          type: 'password',
          value: oldPassword.value,
          onInput: (e) => { oldPassword.value = e.target.value },
          style: 'width: 100%; border: 1px solid #dcdee0; border-radius: 4px; padding: 8px; box-sizing: border-box;'
        })
      ]),
      h('div', { style: 'margin-bottom: 15px;' }, [
        h('div', { style: 'margin-bottom: 5px; text-align: left;' }, '新密码：'),
        h('input', {
          type: 'password',
          value: newPassword.value,
          onInput: (e) => { newPassword.value = e.target.value },
          style: 'width: 100%; border: 1px solid #dcdee0; border-radius: 4px; padding: 8px; box-sizing: border-box;'
        })
      ]),
      h('div', { style: 'margin-bottom: 15px;' }, [
        h('div', { style: 'margin-bottom: 5px; text-align: left;' }, '确认密码：'),
        h('input', {
          type: 'password',
          value: confirmPassword.value,
          onInput: (e) => { confirmPassword.value = e.target.value },
          style: 'width: 100%; border: 1px solid #dcdee0; border-radius: 4px; padding: 8px; box-sizing: border-box;'
        })
      ])
    ]),
  }).then(async () => {
    // 点击确认按钮
    if (!oldPassword.value) {
      showToast('请输入当前密码');
      return;
    }
    
    if (!newPassword.value) {
      showToast('请输入新密码');
      return;
    }
    
    if (newPassword.value !== confirmPassword.value) {
      showToast('两次密码输入不一致');
      return;
    }
    
    try {
      // 显示加载提示
      const loadingInstance = showLoadingToast({
        message: '修改中...',
        forbidClick: true,
        duration: 0
      });
      
      // 调用API更新密码
      const result = await userStore.updatePassword(
        oldPassword.value,
        newPassword.value,
        confirmPassword.value
      );
      
      // 关闭加载提示
      loadingInstance.close();
      
      if (result && result.success) {
        showSuccessToast('密码修改成功，请重新登录');
        await userStore.logout();
        router.replace('/login');
      } else {
        showFailToast((result && result.message) || '密码修改失败');
      }
    } catch (error) {
      console.error('修改密码失败:', error);
      showToast.clear();
      showToast.fail('密码修改失败');
    }
  }).catch(() => {
    // 点击取消按钮
  });
};

const showBioDialog = () => {
  // 使用ref创建响应式变量
  const newBioValue = ref(userBio.value);
  
  showDialog({
    title: '修改个人简介',
    showCancelButton: true,
    confirmButtonText: '确认',
    className: 'bio-dialog',
    message: h('div', { style: 'text-align: left; padding: 10px 0;' }, [
      h('div', { style: 'margin-bottom: 15px;' }, [
        h('div', { style: 'margin-bottom: 5px; text-align: left;' }, '个人简介：'),
        h('textarea', {
          value: newBioValue.value,
          onInput: (e) => { newBioValue.value = e.target.value },
          style: 'width: 100%; border: 1px solid #dcdee0; border-radius: 4px; padding: 8px; box-sizing: border-box; min-height: 100px; resize: vertical;'
        })
      ])
    ])
  }).then(async () => {
    // 点击确认按钮
    try {
      // 显示加载提示
      const loadingInstance = showLoadingToast({
        message: '保存中...',
        forbidClick: true,
        duration: 0
      });
      
      // 调用API更新个人简介
      const result = await userStore.updateUserInfo({ 
        username: userInfo.value?.username || '',
        email: userInfo.value?.email || '',
        telephone: userInfo.value?.telephone || '',
        gender: normalizeProfileGender(userInfo.value?.gender),
        bio: newBioValue.value
      });
      
      // 关闭加载提示
      loadingInstance.close();
      
      if (result && result.success) {
        showSuccessToast('个人简介修改成功');
      } else {
        showFailToast((result && result.message) || '个人简介修改失败');
      }
    } catch (error) {
      console.error('更新个人简介失败:', error);
      showToast.clear();
      showToast.fail('个人简介修改失败');
    }
  }).catch(() => {
    // 点击取消按钮
  });
};

const genderSheetVisible = ref(false);
const genderPickValue = ref(0);

/** 头像弹层（避免 showDialog + h(VNode) 触发 VanDialog message 类型告警） */
const avatarPopupVisible = ref(false);
const avatarBlobUrl = ref('');
const avatarSelectedFile = ref(null);
const avatarUploading = ref(false);

const avatarDisplaySrc = computed(() => {
  if (avatarBlobUrl.value) return avatarBlobUrl.value;
  return resolveAvatarUrl(userInfo.value?.avatar);
});

const revokeAvatarBlob = () => {
  if (avatarBlobUrl.value && avatarBlobUrl.value.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(avatarBlobUrl.value);
    } catch {
      /* ignore */
    }
  }
  avatarBlobUrl.value = '';
};

const onAvatarPopupClosed = () => {
  revokeAvatarBlob();
  avatarSelectedFile.value = null;
  avatarUploading.value = false;
};

/** 头像 URL 无效时回退占位，避免白块 */
const onAvatarImgError = (e) => {
  const el = e?.target;
  if (el && el.tagName === 'IMG') {
    el.src = DEFAULT_AVATAR;
  }
};

const onAvatarFileSelected = (e) => {
  const file = e.target?.files?.[0];
  if (!file) return;
  revokeAvatarBlob();
  avatarSelectedFile.value = file;
  avatarBlobUrl.value = URL.createObjectURL(file);
  e.target.value = '';
};

const showGenderDialog = () => {
  genderPickValue.value = normalizeProfileGender(userInfo.value?.gender);
  genderSheetVisible.value = true;
};

const confirmGenderSheet = async () => {
  const loadingInstance = showLoadingToast({
    message: '保存中...',
    forbidClick: true,
    duration: 0
  });
  try {
    const result = await userStore.updateUserInfo({
      username: userInfo.value?.username || '',
      email: userInfo.value?.email || '',
      telephone: userInfo.value?.telephone || '',
      gender: Number(genderPickValue.value),
      bio: userInfo.value?.bio || ''
    });
    loadingInstance.close();
    genderSheetVisible.value = false;
    if (result && result.success) {
      showSuccessToast('性别修改成功');
    } else {
      showFailToast((result && result.message) || '性别修改失败');
    }
  } catch (error) {
    console.error('更新性别失败:', error);
    loadingInstance.close();
    showToast.fail('性别修改失败');
  }
};

const showUsernameDialog = () => {
  // 使用ref创建响应式变量
  const newUsernameValue = ref(userInfo.value?.username || '');
  
  showDialog({
    title: '修改用户名',
    showCancelButton: true,
    confirmButtonText: '确认',
    className: 'username-dialog',
    message: h('div', { style: 'text-align: left; padding: 10px 0;' }, [
      h('div', { style: 'margin-bottom: 15px;' }, [
        h('div', { style: 'margin-bottom: 5px; text-align: left;' }, '用户名：'),
        h('input', {
          type: 'text',
          value: newUsernameValue.value,
          onInput: (e) => { newUsernameValue.value = e.target.value },
          style: 'width: 100%; border: 1px solid #dcdee0; border-radius: 4px; padding: 8px; box-sizing: border-box;'
        })
      ])
    ])
  }).then(async () => {
    // 点击确认按钮
    try {
      // 显示加载提示
      const loadingInstance = showLoadingToast({
        message: '保存中...',
        forbidClick: true,
        duration: 0
      });
      
      // 调用API更新用户名
      const result = await userStore.updateUserInfo({ 
        username: newUsernameValue.value,
        email: userInfo.value?.email || '',
        telephone: userInfo.value?.telephone || '',
        gender: normalizeProfileGender(userInfo.value?.gender),
        bio: userInfo.value?.bio || ''
      });
      
      // 关闭加载提示
      loadingInstance.close();
      
      if (result && result.success) {
        showSuccessToast('用户名修改成功');
      } else {
        showFailToast((result && result.message) || '用户名修改失败');
      }
    } catch (error) {
      console.error('更新用户名失败:', error);
      showToast.clear();
      showToast.fail('用户名修改失败');
    }
  }).catch(() => {
    // 点击取消按钮
  });
};

const showEmailDialog = () => {
  // 使用ref创建响应式变量
  const newEmailValue = ref(userInfo.value?.email || '');
  
  showDialog({
    title: '修改邮箱',
    showCancelButton: true,
    confirmButtonText: '确认',
    className: 'email-dialog',
    message: h('div', { style: 'text-align: left; padding: 10px 0;' }, [
      h('div', { style: 'margin-bottom: 15px;' }, [
        h('div', { style: 'margin-bottom: 5px; text-align: left;' }, '邮箱：'),
        h('input', {
          type: 'email',
          value: newEmailValue.value,
          onInput: (e) => { newEmailValue.value = e.target.value },
          style: 'width: 100%; border: 1px solid #dcdee0; border-radius: 4px; padding: 8px; box-sizing: border-box;'
        })
      ])
    ])
  }).then(async () => {
    // 点击确认按钮
    try {
      // 显示加载提示
      const loadingInstance = showLoadingToast({
        message: '保存中...',
        forbidClick: true,
        duration: 0
      });
      
      // 调用API更新邮箱
      const result = await userStore.updateUserInfo({ 
        username: userInfo.value?.username || '',
        email: newEmailValue.value,
        telephone: userInfo.value?.telephone || '',
        gender: normalizeProfileGender(userInfo.value?.gender),
        bio: userInfo.value?.bio || ''
      });
      
      // 关闭加载提示
      loadingInstance.close();
      
      if (result && result.success) {
        showSuccessToast('邮箱修改成功');
      } else {
        showFailToast((result && result.message) || '邮箱修改失败');
      }
    } catch (error) {
      console.error('更新邮箱失败:', error);
      showToast.clear();
      showToast.fail('邮箱修改失败');
    }
  }).catch(() => {
    // 点击取消按钮
  });
};

const showPhoneDialog = () => {
  // 使用ref创建响应式变量
  const newPhoneValue = ref(userInfo.value?.telephone || '');
  
  showDialog({
    title: '修改手机号',
    showCancelButton: true,
    confirmButtonText: '确认',
    className: 'phone-dialog',
    message: h('div', { style: 'text-align: left; padding: 10px 0;' }, [
      h('div', { style: 'margin-bottom: 15px;' }, [
        h('div', { style: 'margin-bottom: 5px; text-align: left;' }, '手机号：'),
        h('input', {
          type: 'tel',
          value: newPhoneValue.value,
          onInput: (e) => { newPhoneValue.value = e.target.value },
          style: 'width: 100%; border: 1px solid #dcdee0; border-radius: 4px; padding: 8px; box-sizing: border-box;'
        })
      ])
    ])
  }).then(async () => {
    // 点击确认按钮
    try {
      // 显示加载提示
      const loadingInstance = showLoadingToast({
        message: '保存中...',
        forbidClick: true,
        duration: 0
      });
      
      // 调用API更新手机号
      const result = await userStore.updateUserInfo({ 
        username: userInfo.value?.username || '',
        email: userInfo.value?.email || '',
        telephone: newPhoneValue.value,
        gender: normalizeProfileGender(userInfo.value?.gender),
        bio: userInfo.value?.bio || ''
      });
      
      // 关闭加载提示
      loadingInstance.close();
      
      if (result && result.success) {
        showSuccessToast('手机号修改成功');
      } else {
        showFailToast((result && result.message) || '手机号修改失败');
      }
    } catch (error) {
      console.error('更新手机号失败:', error);
      showToast.clear();
      showToast.fail('手机号修改失败');
    }
  }).catch(() => {
    // 点击取消按钮
  });
};

const showAvatarDialog = () => {
  revokeAvatarBlob();
  avatarSelectedFile.value = null;
  avatarPopupVisible.value = true;
};

const confirmAvatarUpload = async () => {
  if (!avatarSelectedFile.value) {
    showToast('请选择要上传的图片');
    return;
  }

  avatarUploading.value = true;
  const loadingInstance = showLoadingToast({
    message: '上传中...',
    forbidClick: true,
    duration: 0
  });

  try {
    const result = await userStore.updateUserInfo(
      {
        username: userInfo.value?.username || '',
        email: userInfo.value?.email || '',
        telephone: userInfo.value?.telephone || '',
        gender: normalizeProfileGender(userInfo.value?.gender),
        bio: userInfo.value?.bio || ''
      },
      { avatarFile: avatarSelectedFile.value }
    );

    loadingInstance.close();

    if (result && result.success) {
      await userStore.getUserInfoDetail();
      showSuccessToast('头像更新成功');
      avatarPopupVisible.value = false;
    } else {
      showFailToast((result && result.message) || '头像更新失败');
    }
  } catch (error) {
    console.error('上传头像失败:', error);
    loadingInstance.close();
    showToast.fail(extractUploadErrorMessage(error));
  } finally {
    avatarUploading.value = false;
  }
};

const extractUploadErrorMessage = (error) => {
  const d = error.response?.data;
  if (d && typeof d === 'object') {
    if (typeof d.message === 'string') return d.message;
    if (typeof d.msg === 'string') return d.msg;
    if (typeof d.error === 'string') return d.error;
  }
  return error.message || '头像上传失败';
};
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.profile-container {
  padding-top: 56px;
  padding-bottom: 20px;
}

.avatar-group,
.info-group,
.security-group {
  margin-top: 12px;
}

/* 个人信息右侧内容：Vant 默认灰色，改为黑色 */
.profile-page :deep(.van-cell__value) {
  color: #000;
}

.password-dialog .van-dialog__content {
  padding: 20px;
}

.password-form .form-item {
  margin-bottom: 15px;
  text-align: left;
}

.password-form .form-item span {
  display: block;
  margin-bottom: 5px;
  text-align: left;
}

.password-form .password-input {
  width: 100%;
  border: 1px solid #dcdee0;
  border-radius: 4px;
  padding: 8px;
  outline: none;
  box-sizing: border-box;
}

.avatar-file-input {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  cursor: pointer;
}
</style>