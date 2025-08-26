import { defineEventHandler, getCookie, setCookie } from 'h3'

export default defineEventHandler((event) => {
  const id = getCookie(event, 'line_user_id_tmp') || ''
  if (id) setCookie(event, 'line_user_id_tmp', '', { path: '/', maxAge: 0 }) // 1回読んだら破棄（任意）
  return { lineUserId: id }
})
