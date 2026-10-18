const API_BASE_URL = '/api/posts'

async function request(url, options = {}) {
  const token = localStorage.getItem('disi_token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE_URL}${url}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || '请求失败')
  }
  return data
}

// ====================== 登录 & 用户 ======================
export const apiLogin = (password) => {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ password })
  })
}

export const apiGetCurrentUser = () => request('/user/me')

export const apiLogout = () => {
  localStorage.removeItem('disi_token')
  localStorage.removeItem('disi_role')
  localStorage.removeItem('disi_user_id')
  localStorage.removeItem('disi_user_name')
}

// ====================== 头像上传 ======================
export const apiUploadAvatar = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const token = localStorage.getItem('disi_token')
  const res = await fetch(`${API_BASE_URL}/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  })
  return res.json()
}

// ====================== 获赞统计 ======================
export const apiGetLikesCount = () => request('/user/likes-count')

// ====================== 帖子 ======================
export const apiGetPosts = (params = {}) => {
  const query = new URLSearchParams(params)
  return request(`/posts?${query}`)
}

export const apiGetPostDetail = (postId) => request(`/posts/${postId}`)

export const apiCreatePost = (postData) => {
  return request('/posts', {
    method: 'POST',
    body: JSON.stringify(postData)
  })
}

export const apiUpdatePost = (postId, data) => {
  return request(`/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export const apiDeletePost = (postId) => {
  return request(`/posts/${postId}`, { method: 'DELETE' })
}

export const apiPinPost = (postId, pinned) => {
  return request(`/posts/${postId}/pin`, {
    method: 'POST',
    body: JSON.stringify({ pinned })
  })
}

// ====================== 点赞 ======================
export const apiLikePost = (postId) => {
  return request(`/posts/${postId}/like`, { method: 'POST' })
}

// ====================== 评论 ======================
export const apiGetComments = (postId) => request(`/posts/${postId}/comments`)

export const apiAddComment = (postId, content) => {
  return request(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content })
  })
}

export const apiDeleteComment = (postId, commentId) => {
  return request(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' })
}

// ====================== 上传文件 ======================
export const apiUploadFile = async (file, postId) => {
  const formData = new FormData()
  formData.append('file', file)
  const token = localStorage.getItem('disi_token')
  const url = postId ? `${API_BASE_URL}/upload?post_id=${postId}` : `${API_BASE_URL}/upload`
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  })
  return res.json()
}

// ====================== 发布帖子 ======================
export async function publishPost(postData, files) {
  const postRes = await apiCreatePost({
    title: postData.title,
    content: postData.content
  })
  const postId = postRes.id
  if (files && files.length > 0) {
    for (const file of files) {
      await apiUploadFile(file, postId)
    }
  }
  return postId
}

export default {
  login: apiLogin,
  getCurrentUser: apiGetCurrentUser,
  logout: apiLogout,
  uploadAvatar: apiUploadAvatar,
  getLikesCount: apiGetLikesCount,
  getPosts: apiGetPosts,
  getPostDetail: apiGetPostDetail,
  createPost: apiCreatePost,
  updatePost: apiUpdatePost,
  deletePost: apiDeletePost,
  pinPost: apiPinPost,
  likePost: apiLikePost,
  getComments: apiGetComments,
  addComment: apiAddComment,
  deleteComment: apiDeleteComment,
  uploadFile: apiUploadFile,
  publishPost
}
