import { onMounted, reactive } from "vue";
import {
  getTempTokenApi,
  verifyCodeConfigApi,
  verifyCodeSendApi
} from "@/api/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { isEmail, isEmpty, isPhone } from "@pureadmin/utils";
import { useVerifyCode } from "./verifyCode";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { AesEncrypted } from "@/utils/aes";
import { handleOperation } from "@/components/RePlusCRUD";
import { useI18n } from "vue-i18n";

export const useSendVerifyCode = (formDataRef, formData, props, emit) => {
  const { isDisabled, text } = useVerifyCode();
  const { t } = useI18n();

  const defaultValue = {
    form_type: "",
    token: "",
    phone: "",
    email: "",
    target: "",
    captcha_key: "",
    captcha_code: "",
    verify_code: "",
    verify_token: undefined
  };

  formData.value = Object.assign(formData.value, defaultValue);

  const verifyCodeConfig = reactive({
    access: false,
    captcha: false,
    token: false,
    encrypted: false,
    email: false,
    sms: false,
    rate: 60
  });

  const initToken = () => {
    if (verifyCodeConfig.access && verifyCodeConfig.token) {
      getTempTokenApi().then(res => {
        if (res.code === 1000) {
          formData.value.token = res.token;
        }
      });
    }
  };

  const formRules = reactive<FormRules>({
    phone: [
      {
        required: true,
        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.phoneReg"))));
          } else if (!isPhone(value)) {
            callback(new Error(transformI18n($t("login.phoneCorrectReg"))));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ],
    email: [
      {
        required: true,

        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.emailReg"))));
          } else if (!isEmail(value)) {
            callback(new Error(transformI18n($t("login.emailCorrectReg"))));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ],
    captcha_code: [
      {
        required: true,

        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.verifyCodeReg"))));
          } else if (useUserStoreHook().verifyCodeLength !== value.length) {
            callback(
              new Error(transformI18n($t("login.verifyCodeCorrectReg")))
            );
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ],
    verify_code: [
      {
        required: true,

        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.verifyCodeReg"))));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ]
  });

  const formatSendData = () => {
    return {
      form_type: formData.value.form_type,
      token: formData.value.token,
      target: formData.value[formData.value.form_type],
      captcha_key: formData.value.captcha_key,
      captcha_code: formData.value.captcha_code
    };
  };

  const handleSendCode = callback => {
    formData.verify_token = undefined;
    useVerifyCode().start(
      formDataRef.value,
      [formData.value.form_type, "captcha_code"],
      verifyCodeConfig.rate,
      interval => {
        const data = formatSendData();
        if (verifyCodeConfig.encrypted) {
          data["target"] = AesEncrypted(data["token"], data.target);
        }
        handleOperation({
          t,
          apiReq: verifyCodeSendApi({ category: props.category }, data),
          success(res) {
            formData.value.verify_token = res.data.verify_token;
            interval(verifyCodeConfig.rate);
            callback && callback(res.data);
          },
          showSuccessMsg: ["email", "phone"].includes(formData.value.form_type),
          requestEnd() {
            initToken();
          }
        });
      }
    );
  };

  onMounted(() => {
    verifyCodeConfigApi({ category: props.category }).then(res => {
      if (res.code === 1000) {
        Object.keys(res.data).forEach(key => {
          verifyCodeConfig[key] = res.data[key];
        });
        emit("change", { formData: formData.value, verifyCodeConfig });
        if (isEmpty(formData.value.form_type)) {
          if (verifyCodeConfig.sms) {
            formData.value.form_type = "phone";
          }
          if (verifyCodeConfig.email) {
            formData.value.form_type = "email";
          }
        }
        initToken();
      }
    });
  });

  return {
    t,
    text,
    formRules,
    formData,
    isDisabled,
    verifyCodeConfig,
    handleSendCode
  };
};
