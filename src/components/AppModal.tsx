import React, { useEffect, useCallback } from 'react';
import { View, Pressable, StyleSheet, BackHandler, Platform } from 'react-native';
import { F, Ic, T, useTheme } from '../theme/tokens';

export interface ActionSheetOption {
  text: string;
  icon?: string;
  renderIcon?: () => React.ReactNode;
  style?: 'default' | 'destructive' | 'cancel';
  onPress: () => void;
}

interface ActionSheetModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelText?: string;
  onClose: () => void;
}

/**
 * Apple HIG Bottom Action Sheet Modal
 * Used for multi-option selections (e.g. Video Options, Shield actions)
 */
export function ActionSheetModal({
  visible,
  title,
  message,
  options,
  cancelText = 'Cancel',
  onClose,
}: ActionSheetModalProps) {
  const theme = useTheme();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close sheet" />
      <View style={[s.sheet, { backgroundColor: theme.card }]}>
        {/* Grabber Handle */}
        <View style={[s.grabber, { backgroundColor: theme.isDark ? '#545458' : '#c7c7cc' }]} />

        {/* Header */}
        {(title || message) && (
          <View style={s.header}>
            {title ? (
              <T style={[s.sheetTitle, { color: theme.text }]}>{title}</T>
            ) : null}
            {message ? (
              <T numberOfLines={2} style={[s.sheetMessage, { color: theme.sec }]}>
                {message}
              </T>
            ) : null}
          </View>
        )}

        {/* Options Card */}
        <View style={[s.optionsCard, { backgroundColor: theme.cardElevated }]}>
          {options
            .filter((opt) => opt.style !== 'cancel')
            .map((opt, i) => {
              const isDestructive = opt.style === 'destructive';
              const textColor = isDestructive ? theme.red : theme.text;
              const iconColor = isDestructive ? theme.red : theme.blue;

              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    s.optionRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep },
                    pressed && { opacity: 0.6 },
                  ]}
                  onPress={() => {
                    onClose();
                    opt.onPress();
                  }}
                  accessibilityLabel={opt.text}
                >
                  {opt.renderIcon ? (
                    opt.renderIcon()
                  ) : opt.icon ? (
                    <Ic n={opt.icon} c={iconColor} s={20} w={2} />
                  ) : null}
                  <T
                    style={[
                      s.optionText,
                      { color: textColor, fontFamily: isDestructive ? F.s : F.m },
                    ]}
                  >
                    {opt.text}
                  </T>
                </Pressable>
              );
            })}
        </View>

        {/* Cancel Button */}
        <Pressable
          style={({ pressed }) => [
            s.cancelButton,
            { backgroundColor: theme.cardElevated },
            pressed && { opacity: 0.7 },
          ]}
          onPress={onClose}
          accessibilityLabel={cancelText}
        >
          <T style={[s.cancelButtonText, { color: theme.blue }]}>{cancelText}</T>
        </Pressable>
      </View>
    </View>
  );
}

interface ConfirmDialogModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  confirmStyle?: 'default' | 'destructive';
  cancelText?: string;
  onConfirm: () => void;
  onClose?: () => void;
  onCancel?: () => void;
}

/**
 * Apple HIG Confirmation Dialog Modal
 * Replaces default Alert.alert dialogs with consistent theme styling
 */
export function ConfirmDialogModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  confirmStyle = 'default',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
  onCancel,
}: ConfirmDialogModalProps) {
  const theme = useTheme();
  const handleClose = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else if (onClose) {
      onClose();
    }
  }, [onCancel, onClose]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, handleClose]);

  if (!visible) return null;

  const isDestructive = confirmStyle === 'destructive';

  return (
    <View style={s.overlayCenter}>
      <Pressable style={s.backdrop} onPress={handleClose} accessibilityLabel="Cancel" />
      <View
        style={[
          s.dialogCard,
          {
            backgroundColor: theme.cardElevated,
            borderColor: theme.sep,
          },
        ]}
      >
        <View style={s.dialogContent}>
          <T style={[s.dialogTitle, { color: theme.text }]}>{title}</T>
          {message ? (
            <T style={[s.dialogMessage, { color: theme.sec }]}>{message}</T>
          ) : null}
        </View>

        <View style={[s.dialogButtonsRow, { borderTopColor: theme.sep }]}>
          <Pressable
            style={({ pressed }) => [s.dialogBtn, pressed && { opacity: 0.6 }]}
            onPress={handleClose}
            accessibilityLabel={cancelText}
          >
            <T style={[s.dialogBtnText, { color: theme.blue, fontFamily: F.r }]}>
              {cancelText}
            </T>
          </Pressable>

          <View style={[s.dialogDivider, { backgroundColor: theme.sep }]} />

          <Pressable
            style={({ pressed }) => [s.dialogBtn, pressed && { opacity: 0.6 }]}
            onPress={() => {
              handleClose();
              onConfirm();
            }}
            accessibilityLabel={confirmText}
          >
            <T
              style={[
                s.dialogBtnText,
                { color: isDestructive ? theme.red : theme.blue, fontFamily: F.s },
              ]}
            >
              {confirmText}
            </T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

interface NoticeDialogModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttonText?: string;
  onClose: () => void;
}

/**
 * Apple HIG Single-action Notice Dialog Modal
 */
export function NoticeDialogModal({
  visible,
  title,
  message,
  buttonText = 'OK',
  onClose,
}: NoticeDialogModalProps) {
  const theme = useTheme();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={s.overlayCenter}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <View
        style={[
          s.dialogCard,
          {
            backgroundColor: theme.cardElevated,
            borderColor: theme.sep,
          },
        ]}
      >
        <View style={s.dialogContent}>
          <T style={[s.dialogTitle, { color: theme.text }]}>{title}</T>
          {message ? (
            <T style={[s.dialogMessage, { color: theme.sec }]}>{message}</T>
          ) : null}
        </View>

        <View style={[s.dialogButtonsRow, { borderTopColor: theme.sep }]}>
          <Pressable
            style={({ pressed }) => [s.dialogBtn, pressed && { opacity: 0.6 }]}
            onPress={onClose}
            accessibilityLabel={buttonText}
          >
            <T style={[s.dialogBtnText, { color: theme.blue, fontFamily: F.s }]}>
              {buttonText}
            </T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  overlayCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'android' ? 48 : 0,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 72 : 36,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,