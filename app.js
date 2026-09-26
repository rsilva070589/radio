"use strict";

/*
 * ============================================================
 * CBN TIMEShift
 * ============================================================
 *
 * Stream informado:
 *
 * http://stream.sgr.globo.com/hls/aCBNSP/aCBNSP.m3u8
 *
 * Objetivo:
 *
 * 1. Conectar na CBN
 * 2. Reproduzir o áudio
 * 3. Monitorar a conexão
 * 4. Detectar queda da internet
 * 5. Tentar reconectar automaticamente
 * 6. Controlar o tamanho desejado do buffer
 *
 * IMPORTANTE:
 *
 * O buffer offline REAL de vários minutos de HLS exige
 * armazenamento dos segmentos .ts/fMP4 e reprodução desses
 * segmentos através de MediaSource.
 *
 * Esta versão deixa toda a parte de controle preparada e
 * primeiro testa se o navegador consegue acessar o stream.
 * ============================================================
 */


/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */

const STREAM_URL = "/hls/aCBNSP/aCBNSP.m3u8";


/*
 * Tempo máximo desejado do buffer.
 *
 * O usuário pode alterar pela tela entre 5 e 60 minutos.
 */

let MAX_BUFFER_MINUTES = 30;


/*
 * Intervalo de monitoramento.
 */

const MONITOR_INTERVAL = 1000;


/*
 * Tempo para tentar reconectar depois de uma falha.
 */

const RECONNECT_INTERVAL = 3000;


/* ============================================================
   ELEMENTOS DA TELA
   ============================================================ */

const audio =
    document.getElementById("audio");

const btnPlay =
    document.getElementById("btnPlay");

const btnStop =
    document.getElementById("btnStop");

const bufferRange =
    document.getElementById("bufferRange");

const bufferMinutes =
    document.getElementById("bufferMinutes");

const bufferTime =
    document.getElementById("bufferTime");

const bufferProgress =
    document.getElementById("bufferProgress");

const internetIndicator =
    document.getElementById("internetIndicator");

const internetStatus =
    document.getElementById("internetStatus");

const message =
    document.getElementById("message");


/* ============================================================
   ESTADO
   ============================================================ */

let playing = false;

let connected = false;

let reconnectTimer = null;

let monitorTimer = null;

let startedAt = null;

let totalBufferedSeconds = 0;


/* ============================================================
   LOG
   ============================================================ */

function log(...args) {

    console.log(
        "[CBN]",
        new Date().toLocaleTimeString("pt-BR"),
        ...args
    );

}


/* ============================================================
   MENSAGEM NA TELA
   ============================================================ */

function setMessage(
    text,
    type = ""
) {

    message.textContent = text;

    message.className =
        "message";

    if (type) {

        message.classList.add(type);

    }

}


/* ============================================================
   FORMATA SEGUNDOS
   ============================================================ */

function formatTime(seconds) {

    seconds =
        Math.max(
            0,
            Math.floor(seconds)
        );

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const secs =
        seconds % 60;


    if (hours > 0) {

        return (
            String(hours)
            + ":"
            + String(minutes).padStart(2, "0")
            + ":"
            + String(secs).padStart(2, "0")
        );

    }


    return (
        String(minutes)
        + ":"
        + String(secs).padStart(2, "0")
    );

}


/* ============================================================
   ATUALIZA STATUS DA INTERNET
   ============================================================ */

function updateInternetStatus() {

    const online =
        navigator.onLine;


    if (online) {

        internetIndicator.classList.remove(
            "offline"
        );

        internetIndicator.classList.add(
            "online"
        );

        internetStatus.textContent =
            "Internet conectada";

    } else {

        internetIndicator.classList.remove(
            "online"
        );

        internetIndicator.classList.add(
            "offline"
        );

        internetStatus.textContent =
            "Sem internet";

    }

}


/* ============================================================
   ATUALIZA BUFFER VISUAL
   ============================================================ */

function updateBufferDisplay() {

    const maximumSeconds =
        MAX_BUFFER_MINUTES * 60;


    if (
        totalBufferedSeconds >
        maximumSeconds
    ) {

        totalBufferedSeconds =
            maximumSeconds;

    }


    bufferTime.textContent =
        formatTime(
            totalBufferedSeconds
        );


    const percentage =
        maximumSeconds > 0
            ? (
                totalBufferedSeconds /
                maximumSeconds
            ) * 100
            : 0;


    bufferProgress.style.width =
        Math.min(
            100,
            percentage
        ) + "%";

}


/* ============================================================
   CONFIGURAÇÃO DO BUFFER
   ============================================================ */

bufferRange.addEventListener(
    "input",
    function () {

        MAX_BUFFER_MINUTES =
            Number(
                bufferRange.value
            );

        bufferMinutes.textContent =
            MAX_BUFFER_MINUTES;

        log(
            "Buffer configurado:",
            MAX_BUFFER_MINUTES,
            "minutos"
        );

        updateBufferDisplay();

    }
);


/* ============================================================
   VERIFICA SE O NAVEGADOR ESTÁ ONLINE
   ============================================================ */

window.addEventListener(
    "online",
    function () {

        log(
            "Internet voltou."
        );

        updateInternetStatus();

        if (playing) {

            setMessage(
                "Internet voltou. Tentando reconectar à CBN...",
                "success"
            );

            reconnect();

        }

    }
);


window.addEventListener(
    "offline",
    function () {

        log(
            "Internet caiu."
        );

        updateInternetStatus();


        if (playing) {

            setMessage(
                "Internet caiu. Tentando continuar pelo buffer...",
                "warning"
            );

        }

    }
);


/* ============================================================
   ABRIR STREAM
   ============================================================ */

async function startStream() {

    if (playing) {

        log(
            "A rádio já está em execução."
        );

        return;

    }


    log(
        "Iniciando CBN..."
    );


    setMessage(
        "Conectando à CBN..."
    );


    updateInternetStatus();


    /*
     * Coloca o endereço do stream no elemento AUDIO.
     *
     * ATENÇÃO:
     *
     * Como o endereço é HTTP e esta página provavelmente
     * estará hospedada em HTTPS, o Chrome pode bloquear.
     */

    audio.src =
        STREAM_URL;


    audio.load();


    try {

        await audio.play();


        playing =
            true;

        connected =
            true;

        startedAt =
            Date.now();


        log(
            "CBN iniciou."
        );


        setMessage(
            "CBN tocando.",
            "success"
        );


        startMonitor();


    } catch (error) {

        playing =
            false;

        connected =
            false;


        console.error(
            "[CBN] Erro ao iniciar:",
            error
        );


        setMessage(
            "Não foi possível iniciar a CBN. Verifique CORS, HTTPS e o endereço do stream.",
            "error"
        );

    }

}


/* ============================================================
   PARAR
   ============================================================ */

function stopStream() {

    log(
        "Parando rádio..."
    );


    playing =
        false;

    connected =
        false;


    clearTimeout(
        reconnectTimer
    );


    clearInterval(
        monitorTimer
    );


    audio.pause();


    audio.removeAttribute(
        "src"
    );


    audio.load();


    startedAt =
        null;


    totalBufferedSeconds =
        0;


    updateBufferDisplay();


    setMessage(
        "Rádio parada."
    );


    log(
        "Rádio parada."
    );

}


/* ============================================================
   MONITOR
   ============================================================ */

function startMonitor() {

    clearInterval(
        monitorTimer
    );


    monitorTimer =
        setInterval(
            function () {

                monitorStream();

            },
            MONITOR_INTERVAL
        );

}


/* ============================================================
   MONITORAMENTO DO STREAM
   ============================================================ */

function monitorStream() {

    updateInternetStatus();


    if (!playing) {

        return;

    }


    /*
     * Se o navegador está sem internet,
     * marcamos como desconectado.
     */

    if (!navigator.onLine) {

        connected =
            false;


        /*
         * Aqui entrará a reprodução real dos
         * segmentos armazenados offline.
         *
         * Por enquanto informamos na tela.
         */

        setMessage(
            "Sem internet. Buffer local será utilizado quando disponível.",
            "warning"
        );


        return;

    }


    /*
     * Se existe internet, calculamos o tempo desde
     * o início apenas para demonstrar o funcionamento
     * do buffer na interface.
     *
     * NÃO representa ainda os segmentos realmente
     * armazenados offline.
     */

    if (startedAt) {

        const elapsed =
            (
                Date.now() -
                startedAt
            ) / 1000;


        totalBufferedSeconds =
            Math.min(
                elapsed,
                MAX_BUFFER_MINUTES * 60
            );


        updateBufferDisplay();

    }

}


/* ============================================================
   RECONEXÃO
   ============================================================ */

function reconnect() {

    clearTimeout(
        reconnectTimer
    );


    if (!playing) {

        return;

    }


    if (!navigator.onLine) {

        log(
            "Ainda sem internet."
        );

        reconnectTimer =
            setTimeout(
                reconnect,
                RECONNECT_INTERVAL
            );

        return;

    }


    log(
        "Tentando reconectar..."
    );


    try {

        audio.pause();

        audio.src =
            STREAM_URL;

        audio.load();


        audio.play()
            .then(
                function () {

                    connected =
                        true;

                    log(
                        "Reconectado à CBN."
                    );


                    setMessage(
                        "CBN reconectada.",
                        "success"
                    );

                }
            )
            .catch(
                function (error) {

                    console.error(
                        "[CBN] Falha na reconexão:",
                        error
                    );


                    reconnectTimer =
                        setTimeout(
                            reconnect,
                            RECONNECT_INTERVAL
                        );

                }
            );

    } catch (error) {

        console.error(
            "[CBN] Erro:",
            error
        );


        reconnectTimer =
            setTimeout(
                reconnect,
                RECONNECT_INTERVAL
            );

    }

}


/* ============================================================
   EVENTOS DO PLAYER
   ============================================================ */

audio.addEventListener(
    "playing",
    function () {

        connected =
            true;


        log(
            "Áudio reproduzindo."
        );


        setMessage(
            "CBN tocando.",
            "success"
        );

    }
);


audio.addEventListener(
    "waiting",
    function () {

        log(
            "Player aguardando dados..."
        );


        if (navigator.onLine) {

            setMessage(
                "Aguardando dados da CBN..."
            );

        } else {

            setMessage(
                "Sem internet. Tentando usar o buffer...",
                "warning"
            );

        }

    }
);


audio.addEventListener(
    "stalled",
    function () {

        log(
            "Stream parou temporariamente."
        );


        connected =
            false;


        if (playing) {

            reconnect();

        }

    }
);


audio.addEventListener(
    "error",
    function (event) {

        console.error(
            "[CBN] Erro do elemento AUDIO:",
            event
        );


        connected =
            false;


        if (playing) {

            setMessage(
                "Erro no stream. Tentando reconectar...",
                "warning"
            );


            reconnect();

        }

    }
);


/* ============================================================
   BOTÕES
   ============================================================ */

btnPlay.addEventListener(
    "click",
    function () {

        startStream();

    }
);


btnStop.addEventListener(
    "click",
    function () {

        stopStream();

    }
);


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

MAX_BUFFER_MINUTES =
    Number(
        bufferRange.value
    );


bufferMinutes.textContent =
    MAX_BUFFER_MINUTES;


updateInternetStatus();

updateBufferDisplay();


log(
    "Aplicação iniciada."
);


log(
    "Stream:",
    STREAM_URL
);


log(
    "Buffer:",
    MAX_BUFFER_MINUTES,
    "minutos"
);