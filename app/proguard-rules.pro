-keepclassmembers class com.lomu.app.utils.sabr.EjsNTransformSolver$SolverWebView {
    @android.webkit.JavascriptInterface public *;
}
-keepclassmembers class com.lomu.app.utils.cipher.CipherWebView {
    @android.webkit.JavascriptInterface public *;
}
-keepclassmembers class com.lomu.app.utils.potoken.PoTokenWebView {
    @android.webkit.JavascriptInterface public *;
}

-keep class com.lomu.app.utils.cipher.** { *; }
-keep class com.lomu.app.utils.sabr.** { *; }
-keep class com.lomu.app.utils.potoken.** { *; }

-keepclassmembers class * {
    void resume(...);
    void resumeWithException(...);
}

-if @kotlinx.serialization.Serializable class **
-keepclasseswithmembers class <1> {
    static <1>$Companion Companion;
}

-if @kotlinx.serialization.Serializable class ** {
    static **$* *;
}
-keepclasseswithmembers class <2>$<3> {
    kotlinx.serialization.KSerializer serializer(...);
}

-if @kotlinx.serialization.Serializable class ** {
    public static ** INSTANCE;
}
-keepclasseswithmembers class <1> {
    public static <1> INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}

-keepattributes RuntimeVisibleAnnotations,AnnotationDefault

-dontwarn javax.servlet.ServletContainerInitializer
-dontwarn org.bouncycastle.jsse.BCSSLParameters
-dontwarn org.bouncycastle.jsse.BCSSLSocket
-dontwarn org.bouncycastle.jsse.provider.BouncyCastleJsseProvider
-dontwarn org.conscrypt.Conscrypt$Version
-dontwarn org.conscrypt.Conscrypt
-dontwarn org.conscrypt.ConscryptHostnameVerifier
-dontwarn org.openjsse.javax.net.ssl.SSLParameters
-dontwarn org.openjsse.javax.net.ssl.SSLSocket
-dontwarn org.openjsse.net.ssl.OpenJSSE
-dontwarn org.slf4j.impl.StaticLoggerBinder

-keep class org.schabi.newpipe.extractor.services.youtube.protos.** { *; }
-keep class org.schabi.newpipe.extractor.timeago.patterns.** { *; }
-keep class org.mozilla.javascript.** { *; }
-keep class org.mozilla.javascript.engine.** { *; }
-dontwarn org.mozilla.javascript.JavaToJSONConverters
-dontwarn org.mozilla.javascript.tools.**
-keep class javax.script.** { *; }
-dontwarn javax.script.**
-keep class jdk.dynalink.** { *; }
-dontwarn jdk.dynalink.**

-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
}

-dontwarn java.beans.BeanDescriptor
-dontwarn java.beans.BeanInfo
-dontwarn java.beans.IntrospectionException
-dontwarn java.beans.Introspector
-dontwarn java.beans.PropertyDescriptor

-keep class com.atilika.kuromoji.** { *; }

-keep class com.lomu.app.models.PersistQueue { *; }
-keep class com.lomu.app.models.PersistPlayerState { *; }
-keep class com.lomu.app.models.QueueData { *; }
-keep class com.lomu.app.models.QueueType { *; }
-keep class com.lomu.app.playback.queues.** { *; }

-keepclassmembers class * implements java.io.Serializable {
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
}

-dontwarn com.yalantis.ucrop**
-keep class com.yalantis.ucrop** { *; }
-keep interface com.yalantis.ucrop** { *; }

-keep class com.google.android.gms.cast.** { *; }
-keep class androidx.mediarouter.** { *; }

-dontwarn com.google.re2j.**

-keep class kotlin.Metadata { *; }
-keep class kotlin.reflect.** { *; }
-dontwarn kotlin.reflect.**

-keep class io.ktor.** { *; }
-keepclassmembers class io.ktor.** { *; }
-dontwarn io.ktor.**


-keepattributes *Annotation*

-keep class androidx.compose.ui.text.font.FontVariation** { *; }
-keepclassmembers class androidx.compose.ui.text.font.FontVariation** { *; }

