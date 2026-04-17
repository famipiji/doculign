using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DmsApi.Data;
using DmsApi.Models;

namespace DmsApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuthController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            // 1. Look for the user in the database
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.Username);

            // 2. Check if user exists and password matches
            // (Note: In production, use BCrypt to check hashed passwords!)
            if (user == null || user.PasswordHash != request.Password)
            {
                return Unauthorized(new { message = "Invalid username or password" });
            }

            // 3. If successful, return user info
            return Ok(new { message = "Login successful!", username = user.Username, email = user.Email });
        }
    }
}