const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Database connection pool
// IMPORTANT: Update user and password with your MySQL local credentials!
const pool = mysql.createPool({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (rows.length > 0) {
            const user = rows[0];
            res.json({ message: "Login successful", user: { id: user.id, name: user.name, email: user.email }});
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        console.error("Database error during login:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
    const { name, email, password, gender, age } = req.body;
    try {
        const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "Email already exists" });
        }

        // Schema: users table id is int but NOT auto_increment, so we calculate the next ID.
        const [maxIdResult] = await pool.query('SELECT MAX(id) as maxId FROM users');
        const newId = (maxIdResult[0].maxId || 0) + 1;

        await pool.query(
            'INSERT INTO users (id, name, email, password, gender, age) VALUES (?, ?, ?, ?, ?, ?)',
            [newId, name, email, password, gender || 'others', age || 18]
        );

        res.json({ message: "Signup successful", user: { id: newId, name, email }});
    } catch (err) {
        console.error("Database error during signup:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// GET /movies/list
app.get('/movies/list', async (req, res) => {
    const { userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    try {
        let movies = [];
        let hasMore = false;
        // If user logged in, try to personalize based on recent activity
        if (userId) {
            const [history] = await pool.query(`
                SELECT m.name FROM movies m 
                JOIN (
                    SELECT movie_id, watched_at as action_time FROM watch_history WHERE user_id = ?
                    UNION ALL
                    SELECT movie_id, liked_at as action_time FROM likes WHERE user_id = ?
                    UNION ALL
                    SELECT movie_id, clicked_at as action_time FROM clicks WHERE user_id = ?
                ) as combined ON m.id = combined.movie_id
                ORDER BY action_time DESC LIMIT 1
            `, [userId, userId, userId]);

            if (history.length > 0) {
                const lastMovieName = history[0].name;
                const axios = require('axios');
                try {
                    const mlResponse = await axios.get(`http://localhost:8000/recommend/${encodeURIComponent(lastMovieName)}`);
                    const allRecTitles = mlResponse.data.recommendations || [];
                    const recTitles = allRecTitles.slice(offset, offset + limit);
                    hasMore = allRecTitles.length > offset + limit;
                    
                    if (recTitles.length > 0) {
                        const placeholders = recTitles.map(() => '?').join(',');
                        const [recMovies] = await pool.query(`
                            SELECT m.*, 
                            (SELECT COUNT(*) FROM likes l WHERE l.movie_id = m.id) as likes_count,
                            EXISTS(SELECT 1 FROM likes l2 WHERE l2.movie_id = m.id AND l2.user_id = ?) as is_liked
                            FROM movies m WHERE name IN (${placeholders})
                        `, [...recTitles, userId]);
                        movies = recMovies;
                    }
                } catch (e) {
                    console.error("FastAPI error on personalization, falling back.", e.message);
                }
            }
        }

        // Fallback or if no history / no ML results
        if (movies.length === 0) {
            const queryParams = [];
            let selectQuery = `SELECT m.*, (SELECT COUNT(*) FROM likes l WHERE l.movie_id = m.id) as likes_count`;
            
            if (userId) {
                selectQuery += `, EXISTS(SELECT 1 FROM likes l2 WHERE l2.movie_id = m.id AND l2.user_id = ?) as is_liked`;
                queryParams.push(userId);
            }
            
            // For "random" we use RAND(page) to keep pagination somewhat stable but shuffled
            selectQuery += ` FROM movies m ORDER BY RAND(${page}) LIMIT ? OFFSET ?`;
            queryParams.push(limit + 1, offset);
            
            const [fallbackMovies] = await pool.query(selectQuery, queryParams);
            hasMore = fallbackMovies.length > limit;
            movies = fallbackMovies.slice(0, limit);
        }

        res.json({ movies, hasMore });
    } catch (err) {
        console.error("Database error fetching movies:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// GET /movies/?query
app.get('/movies/', async (req, res) => {
    const { query, userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    try {
        if (query) {
            if (userId && page === 1) { // Only log search on first page
                await pool.query('INSERT INTO user_searches (user_id, searches) VALUES (?, ?)', [userId, query]);
            }
            
            const queryParams = [`%${query}%`];
            let selectQuery = `SELECT m.*, (SELECT COUNT(*) FROM likes l WHERE l.movie_id = m.id) as likes_count`;
            if (userId) {
                selectQuery += `, EXISTS(SELECT 1 FROM likes l2 WHERE l2.movie_id = m.id AND l2.user_id = ?) as is_liked`;
                queryParams.unshift(userId); // Add to beginning of array
            }
            selectQuery += ` FROM movies m WHERE m.name LIKE ? LIMIT ? OFFSET ?`;
            queryParams.push(limit + 1, offset);

            const [results] = await pool.query(selectQuery, queryParams);
            const hasMore = results.length > limit;
            return res.json({ movies: results.slice(0, limit), hasMore });
        }
        
        return res.json({ movies: [], hasMore: false });
    } catch (err) {
        console.error("Database error searching movies:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// GET /movies/:id
app.get('/movies/:id', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.query; 

    try {
        const [rows] = await pool.query('SELECT * FROM movies WHERE id = ?', [id]);
        if (rows.length > 0) {
            if (userId) {
                await pool.query('INSERT INTO clicks (user_id, movie_id) VALUES (?, ?)', [userId, id]);
            }
            res.json({ movie: rows[0] });
        } else {
            res.status(404).json({ error: "Movie not found" });
        }
    } catch (err) {
        console.error("Database error fetching movie details:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// GET /movies/:id/recommendations
app.get('/movies/:id/recommendations', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.query;
    
    try {
        const [rows] = await pool.query('SELECT name FROM movies WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Movie not found" });
        const movieName = rows[0].name;

        const axios = require('axios');
        try {
            const mlResponse = await axios.get(`http://localhost:8000/recommend/${encodeURIComponent(movieName)}`);
            const recommendedTitles = mlResponse.data.recommendations || [];
            
            if (recommendedTitles.length === 0) return res.json({ recommendations: [] });

            const placeholders = recommendedTitles.map(() => '?').join(',');
            let selectQuery = `SELECT m.*, (SELECT COUNT(*) FROM likes l WHERE l.movie_id = m.id) as likes_count`;
            let queryParams = [...recommendedTitles];
            
            if (userId) {
                selectQuery += `, EXISTS(SELECT 1 FROM likes l2 WHERE l2.movie_id = m.id AND l2.user_id = ?) as is_liked`;
                queryParams.unshift(userId);
            }
            
            selectQuery += ` FROM movies m WHERE name IN (${placeholders}) LIMIT 20`;
            
            const [recMovies] = await pool.query(selectQuery, queryParams);
            res.json({ recommendations: recMovies });
        } catch (e) {
            console.error("Error fetching from FastAPI:", e.message);
            res.status(500).json({ error: "Error contacting ML service" });
        }
    } catch (err) {
        console.error("Database error fetching recommendations:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// POST /movies/:id/like
app.post('/movies/:id/like', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body; 
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const [movieRows] = await pool.query('SELECT * FROM movies WHERE id = ?', [id]);
        if (movieRows.length === 0) return res.status(404).json({ error: "Movie not found" });
        
        const [existing] = await pool.query('SELECT * FROM likes WHERE user_id = ? AND movie_id = ?', [userId, id]);
        let action = 'liked';
        
        if (existing.length === 0) {
            await pool.query('INSERT INTO likes (user_id, movie_id) VALUES (?, ?)', [userId, id]);
        } else {
            await pool.query('DELETE FROM likes WHERE user_id = ? AND movie_id = ?', [userId, id]);
            action = 'unliked';
        }

        const [likesCountRow] = await pool.query('SELECT COUNT(*) as cnt FROM likes WHERE movie_id = ?', [id]);
        res.json({ message: `Movie ${action}`, likes_count: likesCountRow[0].cnt, action, is_liked: action === 'liked' });
    } catch (err) {
        console.error("Database error liking movie:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// POST /movies/:id/watch
app.post('/movies/:id/watch', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body; 
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        await pool.query('INSERT INTO watch_history (user_id, movie_id) VALUES (?, ?)', [userId, id]);
        res.json({ message: "Movie added to watch history" });
    } catch (err) {
        console.error("Database error saving watch history:", err);
        res.status(500).json({ error: "Database error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
