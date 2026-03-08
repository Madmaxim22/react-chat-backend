import { express } from 'express';
import {cors} from 'cors';

const app = express();
const PORT = process.env.PORT || 7070;

app.use(cors());
app.use(express.json());

const messages = [];

app.get('/messages', (req, res) => {
    const lastMessageId = req.query.from;
    if(lastMessageId === 0) {
        res.json(messages);
    } else {
        const fromIndex = messages.slice(lastMessageId + 1);
        res.json(fromIndex);
    }
});

app.post('/messages', (req, res) => {
    const {message} = req.body;
    messages.push(message);
    res.json({lastMessageId: message.id});
});

// Заменять на {} лучше, когда:
// нужно сохранить структуру массива (длину и индексы);
// важна позиция элемента в массиве;
// вы используете индексы для какой‑то логики;
// это временная метка «удалено» для дальнейшей обработки.
// Замена по индексу выполняется за O(1) — это очень быстро, независимо от размера массива.


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});