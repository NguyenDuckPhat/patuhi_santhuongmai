const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  class User extends Model {
    async comparePassword(candidatePassword) {
      if (!this.password) return false;
      return bcrypt.compare(candidatePassword, this.password);
    }

    toJSON() {
      const values = { ...this.get() };
      delete values.password;
      return values;
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 50]
        }
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: true // Cho phép null đối với tài khoản đăng ký bằng Google
      },
      google_id: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      full_name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      avatar: {
        type: DataTypes.STRING(255),
        defaultValue: '/uploads/avatars/default.png'
      },
      last_active_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      role: {
        type: DataTypes.ENUM('guest', 'member', 'admin'),
        defaultValue: 'member'
      },
      status: {
        type: DataTypes.ENUM('active', 'locked'),
        defaultValue: 'active'
      }
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      hooks: {
        beforeSave: async (user) => {
          if (user.changed('password') && user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        }
      }
    }
  );

  return User;
};
