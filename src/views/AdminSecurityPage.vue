<template>
  <div class="admin-security-page">
    <van-nav-bar title="管理后台 - 安全与黑名单" left-arrow @click-left="onBack" fixed placeholder />

    <div class="admin-security-body">
      <van-cell-group inset title="接口与凭证">
        <van-field :model-value="apiBaseDisplay" label="API Base" readonly type="textarea" rows="2" autosize />
        <van-field
          v-model="adminToken"
          label="X-Admin-Token"
          type="password"
          placeholder="与后端 app.admin.token 一致；本地可用 .env.local 的 VITE_ADMIN_TOKEN"
          clearable
        />
      </van-cell-group>

      <van-tabs v-model:active="activeTab" class="admin-tabs" sticky offset-top="46">
        <van-tab title="用户封禁">
          <van-cell-group inset>
            <van-field v-model="banUserId" label="userId" placeholder="必填" />
            <van-field v-model="banUserReason" label="reason" type="textarea" rows="2" autosize placeholder="可选" />
            <van-cell>
              <div class="admin-btn-row">
                <van-button type="danger" block :loading="loadingBan" @click="onBanUser">封禁用户</van-button>
                <van-button type="primary" block plain :loading="loadingUnban" @click="onUnbanUser">解封用户</van-button>
              </div>
            </van-cell>
          </van-cell-group>
        </van-tab>

        <van-tab title="IP 黑名单">
          <van-cell-group inset title="添加">
            <van-field v-model="ipAdd" label="ip" placeholder="如 192.168.1.1" />
            <van-field v-model="ipAddReason" label="reason" type="textarea" rows="2" autosize placeholder="可选" />
            <van-cell>
              <van-button type="danger" block :loading="loadingIpAdd" @click="onBlacklistIp">拉黑 IP</van-button>
            </van-cell>
          </van-cell-group>
          <van-cell-group inset title="解除">
            <van-field v-model="ipRemove" label="ip" placeholder="要解除的 IP" />
            <van-cell>
              <van-button type="warning" block :loading="loadingIpDel" @click="onUnblacklistIp">解除 IP 拉黑</van-button>
            </van-cell>
          </van-cell-group>
        </van-tab>

        <van-tab title="用户名黑名单">
          <van-cell-group inset title="添加">
            <van-field v-model="usernameAdd" label="username" placeholder="登录名" />
            <van-field v-model="usernameAddReason" label="reason" type="textarea" rows="2" autosize placeholder="可选" />
            <van-cell>
              <van-button type="danger" block :loading="loadingUserAdd" @click="onBlacklistUsername">
                拉黑用户名
              </van-button>
            </van-cell>
          </van-cell-group>
          <van-cell-group inset title="解除">
            <van-field v-model="usernameRemove" label="username" placeholder="要解除的用户名" />
            <van-cell>
              <van-button type="warning" block :loading="loadingUserDel" @click="onUnblacklistUsername">
                解除用户名拉黑
              </van-button>
            </van-cell>
          </van-cell-group>
        </van-tab>

        <van-tab title="黑名单列表">
          <van-cell-group inset>
            <van-cell title="每页条数" :value="String(listSize)" is-link @click="openSizePicker" />
            <van-cell>
              <van-button type="primary" size="small" :loading="loadingList" @click="loadBlacklist">刷新列表</van-button>
            </van-cell>
          </van-cell-group>

          <div class="admin-table-wrap">
            <table class="admin-table" v-if="records.length">
              <thead>
                <tr>
                  <th>id</th>
                  <th>block_type</th>
                  <th>说明</th>
                  <th>block_value</th>
                  <th>reason</th>
                  <th>created_at</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in records" :key="String(row.id)">
                  <td>{{ row.id }}</td>
                  <td>{{ row.block_type }}</td>
                  <td>{{ blockTypeHint(row.block_type) }}</td>
                  <td class="td-mono">{{ row.block_value }}</td>
                  <td>{{ row.reason ?? '' }}</td>
                  <td class="td-mono">{{ row.created_at ?? '' }}</td>
                </tr>
              </tbody>
            </table>
            <van-empty v-else description="暂无数据" />
          </div>

          <div class="admin-pagination" v-if="listTotal > 0">
            <van-pagination
              v-model="listPage"
              :total-items="listTotal"
              :items-per-page="listSize"
              :show-page-size="5"
              @change="onPageChange"
            />
          </div>
        </van-tab>
      </van-tabs>
    </div>

    <van-popup v-model:show="showSizePicker" position="bottom" round>
      <van-cell-group title="每页条数（最大 100）">
        <van-field
          v-model.number="listSizeDraft"
          type="digit"
          label="size"
          placeholder="1-100"
          @blur="applyListSize"
        />
        <van-cell>
          <van-button type="primary" block @click="applyListSizeAndClose">确定</van-button>
        </van-cell>
      </van-cell-group>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import type { BlacklistRow } from '../admin/security/types'
import {
  adminBanUser,
  adminBlacklistIp,
  adminBlacklistUsername,
  adminGetBlacklistPage,
  adminUnbanUser,
  adminUnblacklistIp,
  adminUnblacklistUsername,
  createAdminSecurityClient,
  resolveAdminApiBase
} from '../admin/security/adminSecurityApi'

const router = useRouter()

const apiBaseDisplay = resolveAdminApiBase()
const adminToken = ref(
  typeof import.meta.env.VITE_ADMIN_TOKEN === 'string' ? import.meta.env.VITE_ADMIN_TOKEN : ''
)

/** 与业务用户 axios 分离；请求头仅由拦截器注入 X-Admin-Token */
const adminClient = shallowRef(createAdminSecurityClient(() => adminToken.value))

const activeTab = ref(0)

const banUserId = ref('')
const banUserReason = ref('')
const loadingBan = ref(false)
const loadingUnban = ref(false)

const ipAdd = ref('')
const ipAddReason = ref('')
const ipRemove = ref('')
const loadingIpAdd = ref(false)
const loadingIpDel = ref(false)

const usernameAdd = ref('')
const usernameAddReason = ref('')
const usernameRemove = ref('')
const loadingUserAdd = ref(false)
const loadingUserDel = ref(false)

const listPage = ref(1)
const listSize = ref(20)
const listSizeDraft = ref(20)
const listTotal = ref(0)
const records = ref<BlacklistRow[]>([])
const loadingList = ref(false)
const showSizePicker = ref(false)

function onBack() {
  router.back()
}

function blockTypeHint(t: string): string {
  const m: Record<string, string> = {
    IP: 'IP 地址',
    USERNAME: '用户名',
    USER_ID: '用户 ID'
  }
  return m[t] ?? t
}

function ensureToken(): boolean {
  if (!adminToken.value.trim()) {
    showToast('请填写 X-Admin-Token')
    return false
  }
  return true
}

async function onBanUser() {
  if (!ensureToken()) return
  const userId = banUserId.value.trim()
  if (!userId) {
    showToast('请填写 userId')
    return
  }
  loadingBan.value = true
  try {
    await adminBanUser(adminClient.value, {
      userId,
      reason: banUserReason.value.trim() || undefined
    })
    showToast('封禁成功')
  } catch {
    /* Toast 在 API 层 */
  } finally {
    loadingBan.value = false
  }
}

async function onUnbanUser() {
  if (!ensureToken()) return
  const userId = banUserId.value.trim()
  if (!userId) {
    showToast('请填写 userId')
    return
  }
  loadingUnban.value = true
  try {
    await adminUnbanUser(adminClient.value, { userId })
    showToast('解封成功')
  } catch {
    /* */
  } finally {
    loadingUnban.value = false
  }
}

async function onBlacklistIp() {
  if (!ensureToken()) return
  const ip = ipAdd.value.trim()
  if (!ip) {
    showToast('请填写 ip')
    return
  }
  loadingIpAdd.value = true
  try {
    await adminBlacklistIp(adminClient.value, {
      ip,
      reason: ipAddReason.value.trim() || undefined
    })
    showToast('已拉黑 IP')
  } catch {
    /* */
  } finally {
    loadingIpAdd.value = false
  }
}

async function onUnblacklistIp() {
  if (!ensureToken()) return
  const ip = ipRemove.value.trim()
  if (!ip) {
    showToast('请填写要解除的 ip')
    return
  }
  loadingIpDel.value = true
  try {
    await adminUnblacklistIp(adminClient.value, ip)
    showToast('已解除 IP')
  } catch {
    /* */
  } finally {
    loadingIpDel.value = false
  }
}

async function onBlacklistUsername() {
  if (!ensureToken()) return
  const username = usernameAdd.value.trim()
  if (!username) {
    showToast('请填写 username')
    return
  }
  loadingUserAdd.value = true
  try {
    await adminBlacklistUsername(adminClient.value, {
      username,
      reason: usernameAddReason.value.trim() || undefined
    })
    showToast('已拉黑用户名')
  } catch {
    /* */
  } finally {
    loadingUserAdd.value = false
  }
}

async function onUnblacklistUsername() {
  if (!ensureToken()) return
  const username = usernameRemove.value.trim()
  if (!username) {
    showToast('请填写要解除的用户名')
    return
  }
  loadingUserDel.value = true
  try {
    await adminUnblacklistUsername(adminClient.value, username)
    showToast('已解除用户名')
  } catch {
    /* */
  } finally {
    loadingUserDel.value = false
  }
}

async function loadBlacklist() {
  if (!ensureToken()) return
  loadingList.value = true
  try {
    const page = await adminGetBlacklistPage(adminClient.value, {
      page: listPage.value,
      size: listSize.value
    })
    if (page) {
      records.value = Array.isArray(page.records) ? (page.records as BlacklistRow[]) : []
      listTotal.value = typeof page.total === 'number' ? page.total : 0
    } else {
      records.value = []
      listTotal.value = 0
    }
  } catch {
    records.value = []
    listTotal.value = 0
  } finally {
    loadingList.value = false
  }
}

function onPageChange() {
  void loadBlacklist()
}

function openSizePicker() {
  listSizeDraft.value = listSize.value
  showSizePicker.value = true
}

function applyListSize() {
  let n = Number(listSizeDraft.value)
  if (!Number.isFinite(n) || n < 1) n = 20
  if (n > 100) n = 100
  listSize.value = n
  listSizeDraft.value = n
  listPage.value = 1
}

function applyListSizeAndClose() {
  applyListSize()
  showSizePicker.value = false
  void loadBlacklist()
}

watch(activeTab, (v) => {
  if (v === 3) {
    listSizeDraft.value = listSize.value
    void loadBlacklist()
  }
})

</script>

<style scoped>
.admin-security-page {
  min-height: 100vh;
  background: var(--van-background-2, #f7f8fa);
}
.admin-security-body {
  padding: 12px 0 24px;
}
.admin-tabs {
  margin-top: 8px;
}
.admin-btn-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.admin-table-wrap {
  margin: 12px;
  overflow-x: auto;
  background: #fff;
  border-radius: 8px;
}
.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.admin-table th,
.admin-table td {
  border: 1px solid #ebedf0;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}
.admin-table th {
  background: #f7f8fa;
  white-space: nowrap;
}
.td-mono {
  word-break: break-all;
  font-family: ui-monospace, monospace;
}
.admin-pagination {
  padding: 12px 16px 24px;
}
</style>
