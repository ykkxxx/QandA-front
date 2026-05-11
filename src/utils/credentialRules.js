/** 与后端 UsersServiceImpl.login 校验一致 */

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export const PASSWORD_PATTERN = /^[a-zA-Z0-9_]{6,32}$/;

export const USERNAME_RULE_MESSAGE =
  '用户名：3-20 位，仅允许字母、数字、下划线';

export const PASSWORD_RULE_MESSAGE =
  '密码：6-32 位，仅允许字母、数字、下划线';
