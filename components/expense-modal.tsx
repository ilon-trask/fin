import { Expense } from '@/types/entities';
import React, { useState } from 'react';
import { Modal, Pressable, ModalProps as RNModalProps, StyleSheet, Text, View } from 'react-native';
import Button from './ui/button';
import ThemedInput from './ui/themed-Input';
import ThemedText from './ui/themed-text';

interface ModalProps extends RNModalProps {
    showModal: boolean,
    onClose: () => void,
    onSave: (expense: Expense) => void,
    expense: Expense
}

function ExpenseModal({ style, showModal, onClose, onSave, expense, ...props }: ModalProps) {
    const [localExpense, setLocalExpense] = useState<Expense>(expense)
    return (
        <Modal {...props}
            style={[styles.modal, style]}
            animationType='fade'
            transparent={true}
            visible={showModal}
        >
            <Pressable
                style={styles.bg}
                onPress={onClose}>
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    style={{}}>
                    <View style={styles.content}>
                        <View style={styles.field}>
                            <ThemedText>Amount</ThemedText>
                            <ThemedInput
                                keyboardType='numeric'
                                placeholder='0.00'
                                value={localExpense.amount.toString()}
                                onChangeText={(e) => setLocalExpense(prev => ({ ...prev, amount: +e }))} />
                        </View>
                        <View style={styles.field}>
                            <ThemedText>Date</ThemedText>
                            <ThemedInput
                                value={localExpense.date}
                                onChangeText={(e) => setLocalExpense(prev => ({ ...prev, date: e }))} />
                        </View>
                        <Button onPress={() => onSave(localExpense)}>
                            <Text>
                                Save
                            </Text>
                        </Button>
                    </View>
                </Pressable>
            </Pressable>
        </Modal >
    )
}

export default ExpenseModal

const styles = StyleSheet.create({
    modal: {
        flex: 1,
        backgroundColor: "#111",
        justifyContent: 'center',
        alignItems: 'center'
    },
    bg: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: "rgba(0,0,0,0.4)"
    },
    content: {
        backgroundColor: "#111",
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8
    },
    field: {
        width: '100%',
        gap: 4,
    }
})
