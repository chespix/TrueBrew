import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

// Native toast on Android, plain alert on the web.
export const notify = async (msg) => {
  if (Capacitor.isNativePlatform()) {
    await Toast.show({ text: msg });
  } else {
    alert(msg);
  }
};
