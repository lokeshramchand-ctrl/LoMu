package com.lomu.app.extensions

import androidx.sqlite.db.SimpleSQLiteQuery
import java.net.InetSocketAddress
import java.net.InetSocketAddress.createUnresolved

inline fun <reified T : Enum<T>> String?.toEnum(defaultValue: T): T =
    if (this == null) {
        defaultValue
    } else {
        try {
            enumValueOf(this)
        } catch (e: IllegalArgumentException) {
            defaultValue
        }
    }

fun String.toSQLiteQuery(): SimpleSQLiteQuery = SimpleSQLiteQuery(this)

fun String.toInetSocketAddress(): InetSocketAddress {
    if (startsWith("[")) {
        val closeBracket = indexOf(']')
        val host = substring(1, closeBracket)
        val port = substring(closeBracket + 2)
        return createUnresolved(host, port.toInt())
    }
    val (host, port) = split(":")
    return createUnresolved(host, port.toInt())
}
