import { SIZE } from '@/constants/tokens'
import React from 'react'
import { StyleSheet, TextInput, TextInputProps } from 'react-native'

interface InputProps extends TextInputProps {

}

function ThemedInput({ style, ...props }: InputProps) {
    return (
        <TextInput style={[styles.input, style]} {...props} placeholderTextColor={'#111'} />
    )
}

export default ThemedInput

const styles = StyleSheet.create({
    input: {
        minHeight: SIZE["64"],
        backgroundColor: '#eee'
    }
})
