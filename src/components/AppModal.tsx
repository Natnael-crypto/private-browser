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
