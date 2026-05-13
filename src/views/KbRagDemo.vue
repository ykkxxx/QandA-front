<template>
  <div class="kb-rag-page">
    <van-nav-bar title="知识库 / RAG 预览" left-arrow @click-left="onBack" fixed placeholder />

    <div class="kb-rag-body">
      <van-cell-group inset title="文档入库">
        <van-cell>
          <!-- 使用 Vant Uploader：内置 file input 叠层与 result-type=file，比手写透明 input 在 Edge/部分 WebView 下更稳定 -->
          <van-uploader
            v-model="kbFileList"
            class="kb-van-uploader"
            :max-count="1"
            accept=".pdf,.txt,application/pdf,text/plain"
            result-type="file"
            :preview-image="false"
            :disabled="uploading"
            :after-read="onKbUploaderAfterRead"
          >
            <van-button type="primary" block :loading="uploading" native-type="button">
              选择并上传 .txt / .pdf
            </van-button>
          </van-uploader>
        </van-cell>
        <van-cell v-if="lastUpload" title="上次上传" :label="uploadLabel" />
      </van-cell-group>

      <van-cell-group inset title="RAG 上下文预览" class="kb-rag-block" style="margin-top: 12px">
        <van-field
          v-model="question"
          name="question"
          rows="2"
          autosize
          type="textarea"
          maxlength="2000"
          show-word-limit
          placeholder="输入问题，仅检索拼接上下文（不调大模型）"
        />
        <van-cell>
          <van-button
            type="primary"
            block
            :loading="fetching"
            :disabled="fetching"
            native-type="button"
            @click.stop.prevent="onFetchContext"
          >
            获取上下文
          </van-button>
        </van-cell>
      </van-cell-group>

      <van-cell-group v-if="chunkCount !== null" inset title="结果" style="margin-top: 12px">
        <van-cell title="检索切片条数" :value="String(chunkCount)" />
      </van-cell-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { normalizeJwtToken } from '../utils/authToken'
import { uploadKbDocument, fetchRagContext } from '../api/kbRag'
import type { DocumentUploadData } from '../types/apiResponse'
import type { UploaderFileListItem } from 'vant'

const router = useRouter()

const kbFileList = ref<UploaderFileListItem[]>([])
const question = ref('')
const uploading = ref(false)
const fetching = ref(false)
const lastUpload = ref<DocumentUploadData | null>(null)
const chunkCount = ref<number | null>(null)

const uploadLabel = computed(() => {
  const u = lastUpload.value
  if (!u) return ''
  return `${u.sourceFile} · 分块 ${u.chunkCount} · ${u.message || ''}`
})

function onBack() {
  router.back()
}

function hasToken(): boolean {
  return !!normalizeJwtToken(localStorage.getItem('jwt_token'))
}

/** Edge 等环境偶发 File.size=0；读入内存再 new File 供 multipart 使用 */
async function snapshotUploadFile(raw: File): Promise<File> {
  let buf: ArrayBuffer
  try {
    buf = await raw.arrayBuffer()
  } catch {
    showToast('无法读取所选文件，请重试')
    throw new Error('READ_FILE_FAILED')
  }
  if (buf.byteLength === 0) {
    showToast('所选文件为空，请重新选择')
    throw new Error('EMPTY_FILE')
  }
  const mime =
    raw.type ||
    (/\.pdf$/i.test(raw.name) ? 'application/pdf' : /\.txt$/i.test(raw.name) ? 'text/plain' : 'application/octet-stream')
  return new File([buf], raw.name, { type: mime, lastModified: raw.lastModified })
}

async function onKbUploaderAfterRead(
  items: UploaderFileListItem | UploaderFileListItem[]
) {
  const row = Array.isArray(items) ? items[0] : items
  const raw = row?.file
  if (!raw) {
    kbFileList.value = []
    return
  }
  if (!hasToken()) {
    showToast('请先登录')
    router.push('/login')
    kbFileList.value = []
    return
  }

  uploading.value = true
  try {
    const fileToSend = raw.size > 0 ? raw : await snapshotUploadFile(raw)
    lastUpload.value = await uploadKbDocument(fileToSend)
    showToast('上传成功')
  } catch {
    /* snapshot / uploadKbDocument / unwrap 内已 Toast */
  } finally {
    uploading.value = false
    kbFileList.value = []
  }
}

async function onFetchContext() {
  await nextTick()
  const q = question.value.trim()
  if (!q) {
    showToast('请输入问题')
    return
  }
  if (!hasToken()) {
    showToast('请先登录')
    router.push('/login')
    return
  }
  fetching.value = true
  chunkCount.value = null
  try {
    const data = await fetchRagContext(q)
    chunkCount.value = Array.isArray(data.chunks) ? data.chunks.length : 0
  } catch {
    /* Toast 已在封装内 */
  } finally {
    fetching.value = false
  }
}
</script>

<style scoped>
.kb-rag-page {
  min-height: 100vh;
  background: var(--van-background-2, #f7f8fa);
}
.kb-rag-body {
  padding: 12px 0 24px;
}
.kb-rag-block {
  position: relative;
  z-index: 2;
}
.kb-van-uploader {
  width: 100%;
}
.kb-van-uploader :deep(.van-uploader__wrapper) {
  width: 100%;
}
.kb-van-uploader :deep(.van-uploader__input-wrapper) {
  width: 100%;
}
</style>
