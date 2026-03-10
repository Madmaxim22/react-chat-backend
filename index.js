import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 7070;

app.use(cors({
    origin: true,
    credentials: true,
}));

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
    },
}));

// Присваиваем каждому сеансу стабильный userId на стороне сервера
app.use((req, res, next) => {
    if (!req.session.userId) {
        req.session.userId = uuidv4();
    }
    next();
});

const messages = [];

// Простые структуры для хранения времени последнего сообщения
const lastMessageAtByUser = {};
const lastMessageAtByIp = {};

// Middleware rate limiting по userId и IP
const MESSAGE_MIN_INTERVAL_MS = 1000; // не чаще одного сообщения в секунду

function messagesRateLimiter(req, res, next) {
    const userId = req.session?.userId;
    const ip = req.ip;
    const now = Date.now();

    if (!userId) {
        return res.status(500).json({ error: 'Сессия пользователя не инициализирована' });
    }

    const lastUserTime = lastMessageAtByUser[userId] || 0;
    const lastIpTime = lastMessageAtByIp[ip] || 0;

    if (now - lastUserTime < MESSAGE_MIN_INTERVAL_MS || now - lastIpTime < MESSAGE_MIN_INTERVAL_MS) {
        console.warn(`Превышен лимит сообщений для пользователя ${userId} с IP ${ip}`);
        return res.status(429).json({ error: 'Слишком много сообщений. Пожалуйста, отправляйте реже.' });
    }

    lastMessageAtByUser[userId] = now;
    lastMessageAtByIp[ip] = now;

    next();
}

// Эндпоинт, который отдаёт текущий userId из сессии
app.get('/messages/me', (req, res) => {
    if (!req.session?.userId) {
        return res.status(500).json({ error: 'Сессия пользователя не инициализирована' });
    }

    res.json({ userId: req.session.userId });
});

app.get('/messages', (req, res) => {
    const lastMessageId = parseInt(req.query.from);
    if (Number.isNaN(lastMessageId) || lastMessageId < 0) {
        return res.status(400).json({ error: 'Некорректное значение параметра "from"' });
    }

    if (lastMessageId === 0) {
        res.json(messages);
    } else {
        const fromIndex = messages.slice(lastMessageId);
        res.json(fromIndex);
    }
});

app.post('/messages', messagesRateLimiter, (req, res) => {
    const { content } = req.body || {};

    if (typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Текст сообщения должен быть непустой строкой' });
    }

    const MAX_CONTENT_LENGTH = 1000;
    if (content.length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({ error: `Текст сообщения слишком длинный (максимум ${MAX_CONTENT_LENGTH} символов)` });
    }

    console.log(req.session.userId);

    const newMessage = {
        id: messages.length,
        userId: req.session.userId,
        content: content.trim(),
    };
    messages.push(newMessage);
    res.json({ lastMessageId: messages.length - 1 });
});

// TODO: delete method
/*
    При удалении сообщений из массива не удалять явно, а заменять на {} лучше, когда:
    - нужно сохранить структуру массива (длину и индексы);
    - важна позиция элемента в массиве;
    - вы используете индексы для какой‑то логики;
    - это временная метка «удалено» для дальнейшей обработки.
    Замена по индексу выполняется за O(1) — это очень быстро, независимо от размера массива.
*/


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});